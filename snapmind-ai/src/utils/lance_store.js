import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { LANCE_DIR } from './paths.js';

/**
 * LanceDB Wrapper for SnapMind AI
 */
export class LanceStore {
  constructor(namespace, embeddings) {
    this.namespace = namespace;
    this.embeddings = embeddings;
    this.db = null;
    this.table = null;
  }

  async init() {
    await fs.ensureDir(LANCE_DIR);
    this.db = await lancedb.connect(LANCE_DIR);
    
    const tableNames = await this.db.tableNames();
    if (tableNames.includes(this.namespace)) {
      this.table = await this.db.openTable(this.namespace);
      // Create FTS index for keyword search if not exists
      try {
        await this.table.createIndex('text', { config: lancedb.Index.fts() });
      } catch (e) {
        // Index might already exist
      }
    }
  }

  /**
   * Adds documents to the store with incremental hashing
   * @param {Array} docs - LangChain documents
   */
  async addDocuments(docs) {
    if (!this.db) await this.init();

    // 1. Generate hashes for new docs
    const docsWithHashes = docs.map((doc, index) => {
      const hash = crypto.createHash('sha256').update(doc.pageContent).digest('hex');
      const id = `${doc.metadata.source}_${doc.metadata.loc?.lines?.from || index}`;
      return { ...doc, hash, id };
    });

    // 2. Filter out already indexed documents if table exists
    let toIndex = docsWithHashes;
    if (this.table) {
      const existing = await this.table.query().select(['id', 'hash']).toArray();
      const existingSets = new Set(existing.map(e => `${e.id}_${e.hash}`));
      toIndex = docsWithHashes.filter(d => !existingSets.has(`${d.id}_${d.hash}`));
    }

    if (toIndex.length === 0) return;

    const data = await Promise.all(toIndex.map(async (doc) => {
      const vector = await this.embeddings.embedQuery(doc.pageContent);
      return {
        vector: vector,
        text: doc.pageContent,
        metadata: JSON.stringify(doc.metadata),
        id: doc.id,
        hash: doc.hash
      };
    }));

    if (!this.table) {
      this.table = await this.db.createTable(this.namespace, data);
    } else {
      await this.table.add(data);
    }
  }

  /**
   * Performs a vector similarity search
   * @param {string} query - The search query
   * @param {number} k - Number of results
   */
  async similaritySearch(query, k = 5, options = {}) {
    if (!this.table) return [];
    
    let results;
    if (options.hybrid) {
      // Hybrid search: Vector search + FTS search
      const vector = await this.embeddings.embedQuery(query);
      const vectorResults = await this.table.vectorSearch(vector).limit(k).toArray();
      const ftsResults = await this.table.search(query).limit(k).toArray();
      
      // Merge results (simple deduplication by ID or Text)
      const merged = [...vectorResults, ...ftsResults];
      const seen = new Set();
      results = merged.filter(r => {
        const id = r.text; // Text content as fallback ID
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, k);
    } else {
      const vector = await this.embeddings.embedQuery(query);
      results = await this.table.vectorSearch(vector).limit(k).toArray();
    }

    const finalResults = results.map(r => ({
      pageContent: r.text,
      metadata: JSON.parse(r.metadata),
      score: r._distance
    }));

    // Re-ranking (Feature 24)
    if (options.rerank && options.llm && finalResults.length > 0) {
      try {
        const response = await options.llm.invoke([
          ['system', 'Rate the following snippets by relevance to the query (0-10). Output ONLY the indices of the top 5 most relevant snippets (newline separated).'],
          ['user', `Query: ${query}\n\nSnippets:\n${finalResults.map((r, i) => `[${i}] ${r.pageContent.slice(0, 200)}`).join('\n')}`]
        ]);
        const match = response.content.match(/\d+/g);
        const indices = (match || []).map(Number).filter(n => n < finalResults.length);
        return indices.length > 0 ? indices.map(i => finalResults[i]) : finalResults.slice(0, 5);
      } catch (e) {
        return finalResults.slice(0, 5); // Fallback to distance
      }
    }

    return finalResults;
  }

  /**
   * Deletes documents originating from a specific file path
   * @param {string} sourcePath - The file path to remove
   * @param {{ prefix?: boolean }} options - Match sources that start with sourcePath
   */
  async deleteDocumentsBySource(sourcePath, { prefix = false } = {}) {
    if (!this.table) return;
    try {
      const records = await this.table.query().select(['id', 'metadata']).toArray();
      const idsToDelete = records
        .filter(r => {
           try {
             const source = JSON.parse(r.metadata).source;
             return prefix ? source.startsWith(sourcePath) : source === sourcePath;
           } catch (e) {
             return false;
           }
        })
        .map(r => `'${String(r.id).replace(/'/g, "''")}'`);
        
      if (idsToDelete.length > 0) {
        await this.table.delete(`id IN (${idsToDelete.join(',')})`);
      }
    } catch (e) {
      // Ignore if table deletion fails
    }
  }
}
