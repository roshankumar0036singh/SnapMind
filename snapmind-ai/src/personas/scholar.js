import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
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

export async function startScholar(options = {}) {
  console.log(chalk.cyan('\n🎓 SnapMind Scholar Mode'));
  console.log(chalk.gray('Tips: Use --mount <dir> for folders or pass a PDF path.\n'));

  const { targetPath } = options.mount ? { targetPath: options.mount } : await inquirer.prompt([
    {
      type: 'input',
      name: 'targetPath',
      message: 'Enter PDF path or directory to mount:',
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
      const spinner = ora('Loading and indexing knowledge...').start();
      try {
        const stats = await fs.stat(targetPath);
        let loader;

        if (stats.isDirectory()) {
          loader = new DirectoryLoader(targetPath, {
            '.pdf': (p) => new PDFLoader(p),
          });
        } else if (targetPath.endsWith('.pdf')) {
          loader = new PDFLoader(targetPath);
        } else {
          throw new SnapMindError('Unsupported file type. Scholar persona requires PDFs.', 'INVALID_FILE');
        }

        const rawDocs = await loader.load();
        if (rawDocs.length === 0) throw new SnapMindError('No PDF documents found in path.', 'EMPTY_SOURCE');

        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
        const docs = await splitter.splitDocuments(rawDocs);
        
        vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
        await saveVectorStore(vectorStore, namespace);
        spinner.succeed(`Ready! Indexed ${docs.length} semantic chunks.`);
      } catch (error) {
        spinner.fail('Indexing failed.');
        handleError(error);
        return;
      }
    }
    
    const llm = await getLLM(options);
    const history = [];
    
    while (true) {
      const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.yellow('scholar>') }]);
      if (query.toLowerCase() === 'exit') break;

      if (query.toLowerCase() === '/export') {
        await exportSession(history);
        continue;
      }

      const chatSpinner = ora('Researching...').start();
      try {
        const results = await vectorStore.similaritySearch(query, 3);
        const context = results.map(r => r.pageContent).join('\n\n');
        
        const response = await llm.invoke([
          ['system', 'You are SnapMind Scholar. Answer based ONLY on context. Cite page numbers.'],
          ['user', `Context:\n${context}\n\nQuestion: ${query}`]
        ]);

        chatSpinner.stop();
        console.log(chalk.cyan('\n' + response.content + '\n'));
        
        history.push({ role: 'user', content: query });
        history.push({ role: 'assistant', content: response.content });

        console.log(chalk.gray('Sources:'));
        results.forEach((r, i) => {
          const fileName = path.basename(r.metadata?.source || 'Doc');
          console.log(chalk.gray(` [${i+1}] ${fileName} (Page ${r.metadata?.loc?.pageNumber || '?'})`));
        });
        console.log('');
      } catch (e) {
        chatSpinner.stop();
        handleError(e);
      }
    }

  } catch (error) {
    handleError(error);
  }
}
