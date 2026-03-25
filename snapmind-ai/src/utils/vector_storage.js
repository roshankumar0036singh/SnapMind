import fs from 'fs-extra';
import path from 'path';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import ora from 'ora';

const CACHE_DIR = path.join(process.cwd(), '.snapmind_cache');

export async function saveVectorStore(vectorStore, namespace) {
  await fs.ensureDir(CACHE_DIR);
  const cachePath = path.join(CACHE_DIR, `${namespace}.json`);
  const data = JSON.stringify(vectorStore.memoryVectors);
  await fs.writeFile(cachePath, data);
}

export async function loadVectorStore(namespace, embeddings) {
  const cachePath = path.join(CACHE_DIR, `${namespace}.json`);
  if (!(await fs.pathExists(cachePath))) return null;

  const spinner = ora('Loading cached index...').start();
  try {
    const data = await fs.readFile(cachePath, 'utf8');
    const vectors = JSON.parse(data);
    const vectorStore = new MemoryVectorStore(embeddings);
    vectorStore.memoryVectors = vectors;
    spinner.succeed('Cached index loaded.');
    return vectorStore;
  } catch (e) {
    spinner.fail('Failed to load cache.');
    return null;
  }
}

export function generateNamespace(targetPath) {
  // Simple hash or slug from path
  return Buffer.from(targetPath).toString('base64').replace(/[/+=]/g, '_').slice(-20);
}
