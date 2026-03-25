import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getLLM } from '../utils/llm.js';
import { getKey } from '../utils/credentials.js';
import config from '../utils/config.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, loadVectorStore, saveVectorStore } from '../utils/vector_storage.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

export async function startAnalyst(options = {}) {
  console.log(chalk.green('\n📊 SnapMind Analyst Mode'));
  console.log(chalk.gray('Tips: Load CSV/Excel files to query trends and data points.\n'));

  const { targetPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'targetPath',
      message: 'Enter path to CSV file:',
      validate: (input) => input.length > 0 || 'Path cannot be empty',
    },
  ]);

  try {
    const namespace = generateNamespace(targetPath);
    const provider = config.get('provider');
    let embeddings;
    
    if (provider === 'ollama' && !options.airgap) {
      embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
    } else if (provider === 'openai') {
      embeddings = new OpenAIEmbeddings({ apiKey: await getKey('openai') });
    } else {
      embeddings = new MistralAIEmbeddings({ apiKey: await getKey('mistral') });
    }

    let vectorStore = await loadVectorStore(namespace, embeddings);
    
    if (!vectorStore) {
      const spinner = ora('Parsing data and building index...').start();
      try {
        if (!targetPath.endsWith('.csv')) {
          throw new SnapMindError('Unsupported file type. Analyst persona currently requires CSV.', 'INVALID_FILE');
        }

        const loader = new CSVLoader(targetPath);
        const docs = await loader.load();
        
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

    while (true) {
      const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.green('analyst>') }]);
      if (query.toLowerCase() === 'exit') break;

      const chatSpinner = ora('Calculating...').start();
      try {
        const results = await vectorStore.similaritySearch(query, 5);
        const context = results.map(r => r.pageContent).join('\n---\n');
        
        const response = await llm.invoke([
          ['system', 'You are SnapMind Analyst. Answer questions based on the provided CSV data snippets. \nBe precise with numbers and trends.'],
          ['user', `Data Snippets:\n${context}\n\nQuestion: ${query}`]
        ]);

        chatSpinner.stop();
        console.log(chalk.cyan('\n' + response.content + '\n'));
      } catch (e) {
        chatSpinner.stop();
        handleError(e);
      }
    }
  } catch (error) {
    handleError(error);
  }
}
