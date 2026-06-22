import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = path.resolve(__dirname, '../..');
export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'src', 'templates');

const cacheRoot = process.env.SNAPMIND_CACHE_DIR || path.join(os.homedir(), '.snapmind');

export const CACHE_DIR = cacheRoot;
export const LANCE_DIR = path.join(CACHE_DIR, 'lancedb');
export const SESSION_DIR = path.join(CACHE_DIR, 'sessions');
export const EXPORT_DIR = path.join(CACHE_DIR, 'exports');

const MIGRATION_MARKER = path.join(CACHE_DIR, '.cache-migrated');

/**
 * One-time migration from legacy cwd-relative cache to ~/.snapmind.
 */
export async function migrateLegacyCache() {
  await fs.ensureDir(CACHE_DIR);

  if (await fs.pathExists(MIGRATION_MARKER)) {
    return;
  }

  const legacyRoot = path.join(process.cwd(), '.snapmind_cache');
  if (await fs.pathExists(legacyRoot)) {
    await mergeDirectory(path.join(legacyRoot, 'lancedb'), LANCE_DIR);
    await mergeDirectory(path.join(legacyRoot, 'sessions'), SESSION_DIR);

    const legacyExports = path.join(process.cwd(), 'snapmind_exports');
    if (await fs.pathExists(legacyExports)) {
      await mergeDirectory(legacyExports, EXPORT_DIR);
    }

    try {
      await fs.move(legacyRoot, `${legacyRoot}.bak`, { overwrite: false });
    } catch {
      // Leave legacy cache in place if rename fails.
    }
  }

  await fs.writeFile(MIGRATION_MARKER, new Date().toISOString());
}

async function mergeDirectory(source, destination) {
  if (!(await fs.pathExists(source))) {
    return;
  }

  await fs.ensureDir(destination);
  const entries = await fs.readdir(source);

  for (const entry of entries) {
    const from = path.join(source, entry);
    const to = path.join(destination, entry);
    if (await fs.pathExists(to)) {
      continue;
    }
    await fs.move(from, to, { overwrite: false });
  }
}

export function resolveTemplatePath(name) {
  return path.join(TEMPLATES_DIR, `${name}.json`);
}
