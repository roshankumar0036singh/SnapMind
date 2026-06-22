import fs from 'fs-extra';
import path from 'path';
import Papa from 'papaparse';
import xlsx from 'xlsx';
import { parquetReadObjects } from 'hyparquet';
import { SnapMindError } from './errors.js';

export const ANALYST_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.parquet'];

export function isAnalystDataFile(filePath) {
  return ANALYST_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function rowsToDocuments(rows, source) {
  return rows.map((row, index) => ({
    pageContent: typeof row === 'string' ? row : JSON.stringify(row),
    metadata: {
      source,
      row: index + 1,
      type: 'tabular',
    },
  }));
}

async function loadCsvFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new SnapMindError(`Failed to parse CSV: ${parsed.errors[0].message}`, 'PARSE_ERROR');
  }
  return rowsToDocuments(parsed.data, filePath);
}

async function loadExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const docs = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    docs.push(
      ...rowsToDocuments(rows, `${filePath}#${sheetName}`).map((doc) => ({
        ...doc,
        metadata: { ...doc.metadata, sheet: sheetName },
      }))
    );
  }

  return docs;
}

async function loadParquetFile(filePath) {
  const buffer = await fs.readFile(filePath);
  const rows = await parquetReadObjects({ file: buffer });
  return rowsToDocuments(rows, filePath);
}

export async function loadAnalystFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.csv':
      return loadCsvFile(filePath);
    case '.xlsx':
    case '.xls':
      return loadExcelFile(filePath);
    case '.parquet':
      return loadParquetFile(filePath);
    default:
      throw new SnapMindError(
        `Unsupported file type "${ext}". Supported: ${ANALYST_EXTENSIONS.join(', ')}`,
        'INVALID_FILE'
      );
  }
}

async function walkDirectory(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDirectory(fullPath));
    } else if (entry.isFile() && isAnalystDataFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function loadAnalystDocuments(targetPath) {
  const stats = await fs.stat(targetPath);

  if (stats.isDirectory()) {
    const files = await walkDirectory(targetPath);
    if (files.length === 0) {
      throw new SnapMindError('No CSV, Excel, or Parquet files found in directory.', 'EMPTY_SOURCE');
    }

    const docs = [];
    for (const filePath of files) {
      docs.push(...await loadAnalystFile(filePath));
    }
    return docs;
  }

  if (!isAnalystDataFile(targetPath)) {
    throw new SnapMindError(
      `Unsupported file type. Supported: ${ANALYST_EXTENSIONS.join(', ')}`,
      'INVALID_FILE'
    );
  }

  return loadAnalystFile(targetPath);
}

export async function reindexAnalystFile(vectorStore, filePath) {
  await vectorStore.deleteDocumentsBySource(filePath, { prefix: true });
  const docs = await loadAnalystFile(filePath);
  if (docs.length > 0) {
    await vectorStore.addDocuments(docs);
  }
}
