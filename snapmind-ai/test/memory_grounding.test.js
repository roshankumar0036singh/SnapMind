import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimHistory, buildMessages } from '../src/utils/memory.js';
import { assessRetrieval, formatGroundingRefusal } from '../src/utils/grounding.js';

test('trimHistory keeps the most recent messages', () => {
  const history = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `msg-${i}` }));
  const trimmed = trimHistory(history, 10);
  assert.equal(trimmed.length, 10);
  assert.equal(trimmed[0].content, 'msg-20');
  assert.equal(trimmed[9].content, 'msg-29');
});

test('buildMessages includes system, trimmed history, and user prompt', () => {
  const messages = buildMessages({
    system: 'You are helpful.',
    history: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ],
    user: 'next question',
  });

  assert.deepEqual(messages, [
    ['system', 'You are helpful.'],
    ['user', 'hi'],
    ['assistant', 'hello'],
    ['user', 'next question'],
  ]);
});

test('assessRetrieval rejects empty and low-relevance results', () => {
  assert.equal(assessRetrieval([]).ok, false);
  assert.equal(assessRetrieval([{ score: 2.0 }]).ok, false);
  assert.equal(assessRetrieval([{ score: 0.4 }, { score: 0.8 }]).ok, true);
});

test('formatGroundingRefusal includes actionable guidance', () => {
  const text = formatGroundingRefusal('No sources found.');
  assert.match(text, /cannot answer/i);
  assert.match(text, /grounding off/i);
});
