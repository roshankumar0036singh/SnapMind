import { LanceStore } from './lance_store.js';
import { apiClient } from './api_client.js';
import config from './config.js';
import { LANCE_DIR, SESSION_DIR } from './paths.js';
import * as lancedb from '@lancedb/lancedb';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';

export async function getVectorStore(namespace, embeddings) {
  const store = new LanceStore(namespace, embeddings);
  await store.init();
  return store;
}

export async function globalSearch(query, embeddings, k = 5, session_id = null) {
  const mode = config.get('mode') || 'local';

  if (mode === 'remote') {
    console.log(`\n☁️  Performing Remote Neural Search (via Backend)...`);
    const response = await apiClient.search(query, k, session_id);
    if (!response.success) {
      throw new Error(response.error || 'Remote search failed');
    }
    // Transform backend results to match CLI format
    // Backend returns list of dicts with source_url, content, etc.
    return response.results.map(r => ({
      pageContent: r.content,
      metadata: {
        source: r.source_url,
        score: r.score,
        ...r.metadata
      },
      namespace: r.site_id || 'remote'
    }));
  }

  // Fallback to Local Search (LanceDB)
  const db = await lancedb.connect(LANCE_DIR);
  const tables = await db.tableNames();
  let allResults = [];

  for (const name of tables) {
    const store = new LanceStore(name, embeddings);
    await store.init();
    const results = await store.similaritySearch(query, k);
    allResults.push(...results.map(r => ({ ...r, namespace: name })));
  }

  return sortSearchResults(allResults, k);
}

/**
 * Custom indexing with Summaries (Feature 23)
 */
export async function addDocumentsWithSummary(vectorStore, docs, llm) {
  const summarizedDocs = [];
  for (const doc of docs) {
    // Basic summary for the chunk
    const response = await llm.invoke([
        ['system', 'Summarize the following content in ONE concise sentence for indexing purposes.'],
        ['user', doc.pageContent]
    ]);
    const summary = response.content.trim();
    summarizedDocs.push({
      ...doc,
      metadata: { ...doc.metadata, isSummary: true, summary }
    });
    summarizedDocs.push(doc); // Original chunk
  }
  await vectorStore.addDocuments(summarizedDocs);
}

/**
 * Generates a stable namespace from a source path (SHA-256).
 */
export function generateNamespace(targetPath) {
  const resolved = path.resolve(String(targetPath));
  return crypto.createHash('sha256').update(resolved).digest('hex').slice(0, 32);
}

/**
 * Legacy namespace format kept for backward compatibility.
 */
export function legacyNamespace(targetPath) {
  return Buffer.from(String(targetPath)).toString('base64').replace(/[/+=]/g, '_').slice(-20);
}

function namespaceCandidates(targetPath) {
  const resolved = path.resolve(String(targetPath));
  return [...new Set([generateNamespace(resolved), generateNamespace(targetPath), legacyNamespace(resolved), legacyNamespace(targetPath)])];
}

export async function listNamespaces() {
  const db = await lancedb.connect(LANCE_DIR);
  return db.tableNames();
}

export async function resolveNamespace(targetPath) {
  const candidates = namespaceCandidates(targetPath);
  const tables = await listNamespaces();

  for (const candidate of candidates) {
    if (tables.includes(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    if (await fs.pathExists(path.join(SESSION_DIR, candidate))) return candidate;
  }

  return candidates[0];
}

export async function namespaceExists(namespace) {
  const tables = await listNamespaces();
  return tables.includes(namespace);
}

export async function retrieveContext(query, namespace, embeddings, k = 5, options = {}) {
  const mode = config.get('mode') || 'local';

  if (mode === 'remote') {
    const response = await apiClient.search(query, k, options.session_id || null);
    if (!response.success) {
      throw new Error(response.error || 'Remote search failed');
    }
    return response.results.map((r) => ({
      pageContent: r.content,
      metadata: { source: r.source_url, score: r.score, ...r.metadata },
      score: r.score,
    }));
  }

  const store = await getVectorStore(namespace, embeddings);
  return personaSearch(store, query, k, options);
}

/**
 * Persona-local search with hybrid vector+keyword when enabled in config.
 */
export async function personaSearch(vectorStore, query, k = 5, options = {}) {
  const hybrid = options.hybrid ?? config.get('hybridSearch') !== false;
  return vectorStore.similaritySearch(query, k, { hybrid, ...options });
}

export function sortSearchResults(results, k = 5) {
  return [...results]
    .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))
    .slice(0, k);
}
