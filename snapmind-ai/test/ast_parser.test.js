import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCodeBlocks } from '../src/utils/ast_parser.js';

const sample = `
export function greet(name) {
  return 'hello ' + name;
}

class Widget {
  render() {
    return '<div/>';
  }
}

const helper = (value) => value * 2;
`;

test('extractCodeBlocks finds functions and classes', () => {
  const blocks = extractCodeBlocks(sample, 'sample.js');
  const names = blocks.map((b) => b.name);
  assert.ok(names.includes('greet'));
  assert.ok(names.includes('Widget'));
  assert.ok(names.includes('helper'));
});

test('extractCodeBlocks returns empty array for invalid JS', () => {
  const blocks = extractCodeBlocks('not {{ valid js', 'broken.js');
  assert.equal(blocks.length, 0);
});
