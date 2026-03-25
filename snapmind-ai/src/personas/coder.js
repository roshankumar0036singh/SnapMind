import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { getLLM } from '../utils/llm.js';
import { getMistralKey } from '../utils/credentials.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export async function startCoder(options = {}) {
  const { path } = await inquirer.prompt([
    {
      type: 'input',
      name: 'path',
      message: 'Enter the path to your code directory:',
      default: '.',
    },
  ]);

  const spinner = ora('Analyzing repository...').start();
  
  try {
    // 1. Load Repository (Filter for code files)
    const loader = new DirectoryLoader(path, {
      '.js': (p) => new TextLoader(p),
      '.ts': (p) => new TextLoader(p),
      '.py': (p) => new TextLoader(p),
      '.md': (p) => new TextLoader(p),
      '.json': (p) => new TextLoader(p),
    }, true, 'ignore'); // Ignore subdirectories if they match common ignore patterns? No, 'ignore' strategy is for skipped types.
    
    const rawDocs = await loader.load();
    const filteredDocs = rawDocs.filter(d => !d.metadata.source.includes('node_modules') && !d.metadata.source.includes('.git'));

    // 2. Split
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200,
    });
    const docs = await splitter.splitDocuments(filteredDocs);
    
    // 3. Embeddings 
    let embeddings;
    if (!options.airgap) {
      try {
        const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
        if (response && response.status === 200) {
          embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
        }
      } catch (e) {}
    }
    
    if (!embeddings) {
      const mistralKey = await getMistralKey();
      embeddings = new MistralAIEmbeddings({ apiKey: mistralKey });
    }
    
    // 4. Vector Store
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    
    spinner.succeed(`Success! Indexed ${docs.length} code snippets across ${filteredDocs.length} files.`);
    
    // 5. Chat Loop
    const llm = await getLLM(options);
    console.log(chalk.gray('\nType "exit" to leave or ask about your architecture.\n'));

    while (true) {
      const { query } = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: chalk.blue('coder>'),
        },
      ]);

      if (query.toLowerCase() === 'exit') break;

      const chatSpinner = ora('Scanning logic...').start();
      const results = await vectorStore.similaritySearch(query, 4);
      const context = results.map(r => `File: ${r.metadata.source}\nContent:\n${r.pageContent}`).join('\n\n---\n\n');
      
      const response = await llm.invoke([
        ['system', 'You are SnapMind Coder, an elite software architect assistant. \nAnalyze the provided code snippets to answer questions. \nProvide concise explanations and code examples where possible. \nIf the answer is not in the context, say so.'],
        ['user', `Context:\n${context}\n\nQuestion: ${query}`]
      ]);

      chatSpinner.stop();
      console.log(chalk.cyan('\n' + response.content + '\n'));
    }
  } catch (error) {
    spinner.fail(`Error: ${error.message}`);
  }
}
