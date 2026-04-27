import { LanceStore } from './lance_store.js';
import { apiClient } from './api_client.js';
import config from './config.js';
import * as lancedb from '@lancedb/lancedb';
import path from 'path';

const DB_DIR = path.join(process.cwd(), '.snapmind_cache', 'lancedb');

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
  const db = await lancedb.connect(DB_DIR);
  const tables = await db.tableNames();
  let allResults = [];

  for (const name of tables) {
    const store = new LanceStore(name, embeddings);
    await store.init();
    const results = await store.similaritySearch(query, k);
    allResults.push(...results.map(r => ({ ...r, namespace: name })));
  }

  return allResults
    .sort((a, b) => b.score - a.score) 
    .slice(0, k);
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
 * Generates a unique namespace based on the source path.
 */
export function generateNamespace(targetPath) {
  return Buffer.from(targetPath).toString('base64').replace(/[/+=]/g, '_').slice(-20);
}
