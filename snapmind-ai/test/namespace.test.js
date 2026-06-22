import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { generateNamespace, legacyNamespace, sortSearchResults } from '../src/utils/vector_storage.js';

test('generateNamespace is stable and 32 chars', () => {
  const ns = generateNamespace('./docs');
  assert.equal(ns.length, 32);
  assert.equal(ns, generateNamespace('./docs'));
  assert.match(ns, /^[a-f0-9]{32}$/);
});

test('generateNamespace resolves relative paths consistently', () => {
  const a = generateNamespace(path.resolve('project'));
  const b = generateNamespace('project');
  assert.equal(a, b);
});

test('legacyNamespace keeps backward-compatible format', () => {
  const legacy = legacyNamespace('/tmp/sample.pdf');
  assert.equal(legacy.length, 20);
  assert.doesNotMatch(legacy, /[/+=]/);
});

test('sortSearchResults prefers lower distance scores', () => {
  const sorted = sortSearchResults([
    { pageContent: 'far', score: 0.9 },
    { pageContent: 'near', score: 0.1 },
    { pageContent: 'mid', score: 0.5 },
  ], 2);

  assert.equal(sorted[0].pageContent, 'near');
  assert.equal(sorted[1].pageContent, 'mid');
});
