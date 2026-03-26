import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, loadVectorStore, saveVectorStore } from '../utils/vector_storage.js';
import { exportSession } from '../utils/exporter.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

const { CHUNK_SIZE, CHUNK_OVERLAP, SIMILARITY_K } = NLP_CONFIG.ANALYST;

export async function startAnalyst(options = {}) {
  console.log(chalk.green('\n📊 SnapMind Analyst Mode'));
  console.log(chalk.gray('Tips: Load CSV/Excel files to query trends. Use /export to save results. \n'));

  let targetPath;
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select a data source for analysis:',
      choices: [
        { name: '📄 Select Specific CSV File', value: 'file' },
        { name: '📂 Scan Current Folder (.)', value: 'current' },
        { name: '🔌 Mount External Folder (Absolute Path)', value: 'mount' },
        { name: '🏠 Exit to Menu', value: 'exit' }
      ]
    }
  ]);

  if (action === 'exit') return;
  if (action === 'file') {
    const { path: filePath } = await inquirer.prompt([
      { type: 'input', name: 'path', message: 'Enter path to CSV file:', validate: (input) => input.endsWith('.csv') && fs.pathExists(input) || 'Invalid CSV path' }
    ]);
    targetPath = filePath;
  } else if (action === 'current') {
    targetPath = '.';
  } else if (action === 'mount') {
    const { path: customPath } = await inquirer.prompt([
      { type: 'input', name: 'path', message: 'Enter absolute path to folder:', validate: (input) => fs.pathExists(input) || 'Path does not exist' }
    ]);
    targetPath = customPath;
  }

  try {
    const namespace = generateNamespace(targetPath);
    const embeddings = await getEmbeddings(options);
    let vectorStore = await loadVectorStore(namespace, embeddings);
    
    if (!vectorStore) {
      const spinner = ora('Parsing data and building index...').start();
      try {
        const stats = await fs.stat(targetPath);
        let loader;

        if (stats.isDirectory()) {
          loader = new DirectoryLoader(targetPath, {
            '.csv': (p) => new CSVLoader(p),
          }, true);
        } else if (targetPath.endsWith('.csv')) {
          loader = new CSVLoader(targetPath);
        } else {
          throw new SnapMindError('Unsupported file type. Analyst persona currently requires CSV.', 'INVALID_FILE');
        }

        const docs = await loader.load();
        if (docs.length === 0) throw new SnapMindError('No CSV data found.', 'EMPTY_SOURCE');
        
        vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
        await saveVectorStore(vectorStore, namespace);
        spinner.succeed(`Success! Indexed ${docs.length} rows of data.`);
      } catch (error) {
        spinner.fail('Data loading failed.');
        handleError(error);
        return;
      }
    }
    
    const llm = await getLLM(options);
    const history = [];

    while (true) {
      const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.green('analyst>') }]);
      if (query.toLowerCase() === 'exit') break;

      if (query.toLowerCase() === '/table') {
        const tableSpinner = ora('Formatting data table...').start();
        try {
          const results = await vectorStore.similaritySearch('summary, overview, data points', 10);
          const tableContext = results.map(r => r.pageContent).join('\n---\n');
          
          const response = await llm.invoke([
            ['system', 'Extract the data points from the provided CSV snippets and format them as a clean Markdown table. Only output the table.'],
            ['user', `Data Snippets:\n${tableContext}`]
          ]);

          tableSpinner.stop();
          console.log(chalk.cyan('\n' + response.content + '\n'));
          continue;
        } catch (e) {
          tableSpinner.stop();
          handleError(e);
          continue;
        }
      }

      const chatSpinner = ora('Calculating...').start();
      try {
        const results = await vectorStore.similaritySearch(query, SIMILARITY_K);
        const context = results.map(r => r.pageContent).join('\n---\n');
        
        const response = await llm.invoke([
          ['system', 'You are SnapMind Analyst. Answer questions based on the provided CSV data snippets. \nBe precise with numbers and trends.'],
          ['user', `Data Snippets:\n${context}\n\nQuestion: ${query}`]
        ]);

        chatSpinner.stop();
        console.log(chalk.cyan('\n' + response.content + '\n'));

        history.push({ role: 'user', content: query });
        history.push({ role: 'assistant', content: response.content });
      } catch (e) {
        chatSpinner.stop();
        handleError(e);
      }
    }
  } catch (error) {
    handleError(error);
  }
}
