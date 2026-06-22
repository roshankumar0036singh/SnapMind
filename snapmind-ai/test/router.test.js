import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeModel } from '../src/utils/router.js';

test('routeModel uses fast model for simple prompts', () => {
  assert.equal(routeModel('hello', { silent: true }), 'gpt-4o-mini');
});

test('routeModel uses powerful model for complex prompts', () => {
  const model = routeModel('Please refactor this architecture and debug the trace comprehensively?', { silent: true });
  assert.equal(model, 'gpt-4o');
});

test('routeModel respects explicit model override', () => {
  assert.equal(routeModel('anything', { model: 'gpt-4-turbo', silent: true }), 'gpt-4-turbo');
});
