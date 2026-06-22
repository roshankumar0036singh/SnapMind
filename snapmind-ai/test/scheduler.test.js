import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

test('addSchedule rejects missing namespace and mount', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'snapmind-scheduler-'));
  process.env.SNAPMIND_CACHE_DIR = tmp;

  const { addSchedule } = await import('../src/utils/scheduler.js');

  await assert.rejects(
    () => addSchedule({ query: 'summary', cron: '0 9 * * 1' }),
    /namespace|mount/i
  );

  await assert.rejects(
    () => addSchedule({ query: 'summary', cron: 'not-a-cron', namespace: 'abc123' }),
    /cron/i
  );

  await assert.rejects(
    () => addSchedule({ query: 'summary', cron: '0 9 * * 1', namespace: 'abc123' }),
    /not indexed/i
  );

  await rm(tmp, { recursive: true, force: true });
  delete process.env.SNAPMIND_CACHE_DIR;
});

test('addSchedule accepts mount-derived namespace when path is not indexed', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'snapmind-scheduler-'));
  process.env.SNAPMIND_CACHE_DIR = tmp;

  const { addSchedule } = await import('../src/utils/scheduler.js');
  const mountPath = path.join(tmp, 'project');

  await assert.rejects(
    () => addSchedule({ query: 'summary', cron: '0 9 * * 1', mount: mountPath }),
    /not indexed/i
  );

  await rm(tmp, { recursive: true, force: true });
  delete process.env.SNAPMIND_CACHE_DIR;
});
