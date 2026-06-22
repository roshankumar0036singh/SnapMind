import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { extractCodeBlocks } from './ast_parser.js';
import { NLP_CONFIG } from './constants.js';

const CODE_EXTENSIONS = new Set(['.js', '.ts', '.py', '.md', '.json']);
const { CHUNK_SIZE, CHUNK_OVERLAP } = NLP_CONFIG.CODER;

export function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function getRepoChanges(repoPath) {
  if (!(await fs.pathExists(path.join(repoPath, '.git')))) {
    return null;
  }

  const git = simpleGit(repoPath);
  await git.fetch().catch(() => {});
  const status = await git.status();

  const changed = new Set([
    ...status.modified,
    ...status.created,
    ...status.not_added,
    ...status.renamed.map((r) => r.to),
  ]);

  const deleted = [...status.deleted, ...status.renamed.map((r) => r.from)];

  return {
    changed: [...changed].filter((f) => isCodeFile(f)),
    deleted: deleted.filter((f) => isCodeFile(f)),
  };
}

export async function indexCodeFile(vectorStore, filePath, repoRoot = path.dirname(filePath)) {
  const loader = new TextLoader(path.resolve(repoRoot, filePath));
  const rawDocs = await loader.load();
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
  const finalDocs = [];

  for (const doc of rawDocs) {
    const isJS = doc.metadata.source.endsWith('.js') || doc.metadata.source.endsWith('.ts');
    if (isJS) {
      const blocks = extractCodeBlocks(doc.pageContent, doc.metadata.source);
      if (blocks.length > 0) {
        blocks.forEach((block) => {
          finalDocs.push({
            pageContent: block.content,
            metadata: { ...doc.metadata, blockName: block.name, blockType: block.type },
          });
        });
        continue;
      }
    }
    finalDocs.push(...await splitter.splitDocuments([doc]));
  }

  await vectorStore.deleteDocumentsBySource(rawDocs[0]?.metadata?.source || path.resolve(repoRoot, filePath));
  if (finalDocs.length > 0) {
    await vectorStore.addDocuments(finalDocs);
  }

  return finalDocs.length;
}

export async function syncRepoIndex(repoPath, vectorStore) {
  const changes = await getRepoChanges(repoPath);
  if (!changes) {
    return { synced: false, reason: 'Not a git repository', updated: 0, removed: 0 };
  }

  let updated = 0;
  let removed = 0;

  for (const deleted of changes.deleted) {
    const abs = path.resolve(repoPath, deleted);
    await vectorStore.deleteDocumentsBySource(abs);
    removed += 1;
  }

  for (const file of changes.changed) {
    const abs = path.resolve(repoPath, file);
    if (!(await fs.pathExists(abs))) continue;
    await indexCodeFile(vectorStore, file, repoPath);
    updated += 1;
  }

  return { synced: true, updated, removed };
}
