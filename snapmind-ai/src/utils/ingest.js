import fs from 'fs-extra';
import path from 'path';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getEmbeddings } from './llm.js';
import { getVectorStore, resolveNamespace, generateNamespace } from './vector_storage.js';
import { loadAnalystDocuments, isAnalystDataFile } from './data_loaders.js';
import { indexCodeFile, isCodeFile } from './repo_sync.js';
import { NLP_CONFIG } from './constants.js';
import { SnapMindError } from './errors.js';

const { CHUNK_SIZE, CHUNK_OVERLAP } = NLP_CONFIG.SCHOLAR;

export const INGEST_TYPES = ['auto', 'pdf', 'code', 'data'];

function detectIngestType(targetPath, explicitType = 'auto') {
  if (explicitType !== 'auto') return explicitType;

  const ext = path.extname(targetPath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (isAnalystDataFile(targetPath)) return 'data';
  if (isCodeFile(targetPath)) return 'code';
  return 'code';
}

async function detectDirectoryIngestType(dirPath) {
  const entries = await fs.readdir(dirPath);
  for (const entry of entries) {
    const full = path.join(dirPath, entry);
    const stats = await fs.stat(full);
    if (!stats.isFile()) continue;
    if (entry.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (isAnalystDataFile(full)) return 'data';
  }
  return 'code';
}

async function ingestPdf(targetPath, vectorStore, pages = null) {
  const stats = await fs.stat(targetPath);
  let loader;

  if (stats.isDirectory()) {
    loader = new DirectoryLoader(targetPath, { '.pdf': (p) => new PDFLoader(p) }, true);
  } else {
    loader = new PDFLoader(targetPath);
  }

  let rawDocs = await loader.load();
  if (pages) {
    const [start, end] = pages.split('-').map(Number);
    rawDocs = rawDocs.filter((d) => {
      const pg = d.metadata?.loc?.pageNumber;
      return pg >= (start || 0) && pg <= (end || Infinity);
    });
  }

  if (rawDocs.length === 0) {
    throw new SnapMindError('No PDF documents found to index.', 'EMPTY_SOURCE');
  }

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
  const docs = await splitter.splitDocuments(rawDocs);
  await vectorStore.addDocuments(docs);
  return docs.length;
}

async function ingestCode(targetPath, vectorStore) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    const chunks = await indexCodeFile(vectorStore, targetPath, path.dirname(targetPath));
    return chunks;
  }

  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() && isCodeFile(full)) {
        files.push(full);
      }
    }
  }
  await walk(targetPath);

  let total = 0;
  for (const file of files) {
    total += await indexCodeFile(vectorStore, file, targetPath);
  }
  return total;
}

async function ingestData(targetPath, vectorStore) {
  const docs = await loadAnalystDocuments(targetPath);
  await vectorStore.addDocuments(docs);
  return docs.length;
}

/**
 * Indexes a file or directory into the vector store without starting a persona session.
 */
export async function ingestSource(targetPath, options = {}) {
  const resolved = path.resolve(targetPath);
  if (!(await fs.pathExists(resolved))) {
    throw new SnapMindError(`Path not found: ${resolved}`, 'INVALID_PATH');
  }

  const stats = await fs.stat(resolved);
  const ingestType = stats.isDirectory()
    ? await detectDirectoryIngestType(resolved)
    : detectIngestType(resolved, options.type || 'auto');
  const finalType = options.type && options.type !== 'auto' ? options.type : ingestType;
  const namespace = options.namespace || generateNamespace(resolved);
  const embeddings = await getEmbeddings(options);
  const vectorStore = await getVectorStore(namespace, embeddings);

  let chunks = 0;
  switch (finalType) {
    case 'pdf':
      chunks = await ingestPdf(resolved, vectorStore, options.pages);
      break;
    case 'data':
      chunks = await ingestData(resolved, vectorStore);
      break;
    case 'code':
    default:
      chunks = await ingestCode(resolved, vectorStore);
      break;
  }

  return {
    namespace,
    resolvedNamespace: await resolveNamespace(resolved),
    type: finalType,
    chunks,
    path: resolved,
  };
}
