import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

class MockEmbeddings {
  async embedQuery(text) {
    const seed = text.length;
    return Array.from({ length: 8 }, (_, i) => (seed + i) / 100);
  }
}

test('LanceStore indexes and searches documents', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'snapmind-lance-'));
  process.env.SNAPMIND_CACHE_DIR = tmp;

  const { LanceStore } = await import('../src/utils/lance_store.js');
  const embeddings = new MockEmbeddings();
  const store = new LanceStore('test_ns', embeddings);

  await store.addDocuments([
    { pageContent: 'authentication middleware for JWT tokens', metadata: { source: '/auth.js' } },
    { pageContent: 'database migration scripts for postgres', metadata: { source: '/db.sql' } },
  ]);

  const results = await store.similaritySearch('JWT auth', 2, { hybrid: false });
  assert.equal(results.length, 2);

  await store.deleteDocumentsBySource('/auth.js');
  const afterDelete = await store.similaritySearch('database migration', 2, { hybrid: false });
  assert.equal(afterDelete.length, 1);
  assert.match(afterDelete[0].pageContent.toLowerCase(), /postgres/);

  await rm(tmp, { recursive: true, force: true });
  delete process.env.SNAPMIND_CACHE_DIR;
});
