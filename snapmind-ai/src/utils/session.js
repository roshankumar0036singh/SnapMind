import fs from 'fs-extra';
import path from 'path';
import { SESSION_DIR } from './paths.js';
import { legacyNamespace, generateNamespace } from './vector_storage.js';

/**
 * Saves conversation history to a local JSON file.
 * @param {string} namespace - The unique store namespace
 * @param {Array} history - The chat history array
 * @param {string} [name='latest'] - The name of the snapshot
 */
export async function saveSession(namespace, history, name = 'latest') {
  if (history.length === 0) return;
  const targetDir = path.join(SESSION_DIR, namespace);
  await fs.ensureDir(targetDir);
  const sessionPath = path.join(targetDir, `${name}.json`);
  await fs.writeJson(sessionPath, history, { spaces: 2 });
}

/**
 * Loads conversation history from a local JSON file.
 * @param {string} namespace - The unique store namespace
 * @param {string} [name='latest'] - The name of the snapshot to load
 */
export async function loadSession(namespace, name = 'latest', legacyNs = null) {
  const sessionPath = path.join(SESSION_DIR, namespace, `${name}.json`);
  if (await fs.pathExists(sessionPath)) {
    return await fs.readJson(sessionPath);
  }

  if (legacyNs && legacyNs !== namespace) {
    const legacyPath = path.join(SESSION_DIR, legacyNs, `${name}.json`);
    if (await fs.pathExists(legacyPath)) {
      return await fs.readJson(legacyPath);
    }
  }

  return [];
}

export async function loadSessionForPath(targetPath, name = 'latest') {
  const namespace = generateNamespace(targetPath);
  const legacy = legacyNamespace(targetPath);
  return loadSession(namespace, name, legacy);
}

/**
 * Lists all available snapshots for a namespace.
 */
export async function listSnapshots(namespace) {
  const targetDir = path.join(SESSION_DIR, namespace);
  if (!(await fs.pathExists(targetDir))) return [];
  const files = await fs.readdir(targetDir);
  return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
}
