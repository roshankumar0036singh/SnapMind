import fs from 'fs-extra';
import path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { LANCE_DIR, SESSION_DIR } from './paths.js';
import { listNamespaces } from './vector_storage.js';

async function tableRowCount(db, name) {
  const table = await db.openTable(name);
  if (typeof table.countRows === 'function') {
    return await table.countRows();
  }
  const rows = await table.query().select(['id']).toArray();
  return rows.length;
}

export async function getIndexStats() {
  const db = await lancedb.connect(LANCE_DIR);
  const tables = await listNamespaces();
  const stats = [];

  for (const namespace of tables) {
    let rowCount = 0;
    try {
      rowCount = await tableRowCount(db, namespace);
    } catch {
      rowCount = 0;
    }

    const sessionDir = path.join(SESSION_DIR, namespace);
    let sessionCount = 0;
    if (await fs.pathExists(sessionDir)) {
      const files = await fs.readdir(sessionDir);
      sessionCount = files.filter((f) => f.endsWith('.json')).length;
    }

    stats.push({ namespace, rowCount, sessionCount });
  }

  return stats.sort((a, b) => a.namespace.localeCompare(b.namespace));
}

export async function clearNamespace(namespace) {
  const tables = await listNamespaces();
  if (!tables.includes(namespace)) {
    return false;
  }

  const db = await lancedb.connect(LANCE_DIR);
  await db.dropTable(namespace);
  await fs.remove(path.join(SESSION_DIR, namespace));
  return true;
}

export async function clearAllNamespaces() {
  const tables = await listNamespaces();
  for (const namespace of tables) {
    await clearNamespace(namespace);
  }
  return tables.length;
}
