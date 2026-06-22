import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import xlsx from 'xlsx';
import {
  isAnalystDataFile,
  loadAnalystFile,
  ANALYST_EXTENSIONS,
} from '../src/utils/data_loaders.js';

test('isAnalystDataFile recognizes supported extensions', () => {
  for (const ext of ANALYST_EXTENSIONS) {
    assert.equal(isAnalystDataFile(`data${ext}`), true);
  }
  assert.equal(isAnalystDataFile('data.json'), false);
});

test('loadAnalystFile parses CSV rows', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'snapmind-csv-'));
  const filePath = path.join(tmp, 'sample.csv');
  await writeFile(filePath, 'name,value\nalpha,1\nbeta,2\n');

  const docs = await loadAnalystFile(filePath);
  assert.equal(docs.length, 2);
  assert.match(docs[0].pageContent, /alpha/);
  assert.equal(docs[0].metadata.source, filePath);

  await rm(tmp, { recursive: true, force: true });
});

test('loadAnalystFile parses Excel workbook sheets', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'snapmind-xlsx-'));
  const filePath = path.join(tmp, 'sample.xlsx');
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([
    ['region', 'sales'],
    ['north', 100],
    ['south', 200],
  ]);
  xlsx.utils.book_append_sheet(workbook, sheet, 'Q1');
  xlsx.writeFile(workbook, filePath);

  const docs = await loadAnalystFile(filePath);
  assert.equal(docs.length, 2);
  assert.match(docs[0].metadata.source, /#Q1$/);

  await rm(tmp, { recursive: true, force: true });
});
