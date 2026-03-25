import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { getLLM } from '../utils/llm.js';
import { getMistralKey } from '../utils/credentials.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export async function startScholar(options = {}) {
  const { path } = await inquirer.prompt([
    {
      type: 'input',
      name: 'path',
      message: 'Enter the path to your PDF file or directory:',
      validate: (input) => input.length > 0 || 'Path cannot be empty',
    },
  ]);

  const spinner = ora('Loading and indexing documents...').start();
  
  try {
    // 1. Load PDF
    const loader = new PDFLoader(path);
    const rawDocs = await loader.load();
    
    // 2. Split
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await splitter.splitDocuments(rawDocs);
    
    // 3. Embeddings (Fallback logic matching LLM)
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
    
    // 4. Vector Store (Memory)
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    
    spinner.succeed(`Success! Indexed ${docs.length} chunks from your academic source.`);
    
    // 5. Chat Loop
    const llm = await getLLM(options);
    console.log(chalk.gray('\nType "exit" to leave or "/export" to save the session.\n'));

    while (true) {
      const { query } = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: chalk.yellow('scholar>'),
        },
      ]);

      if (query.toLowerCase() === 'exit') break;

      const chatSpinner = ora('Thinking...').start();
      const results = await vectorStore.similaritySearch(query, 3);
      const context = results.map(r => r.pageContent).join('\n\n');
      
      const response = await llm.invoke([
        ['system', 'You are SnapMind Scholar, a hyper-focused academic assistant. \nAnswer based ONLY on the provided context. If unsure, say "I cannot find this in your files." \nAlways cite the exact source if possible.'],
        ['user', `Context:\n${context}\n\nQuestion: ${query}`]
      ]);

      chatSpinner.stop();
      console.log(chalk.cyan('\n' + response.content + '\n'));
      
      // Basic Citation list
      console.log(chalk.gray('Sources used:'));
      results.forEach((r, i) => {
        console.log(chalk.gray(` [${i+1}] ${r.metadata?.source || 'Document'} (Page ${r.metadata?.loc?.pageNumber || 'N/A'})`));
      });
      console.log('\n');
    }
  } catch (error) {
    spinner.fail(`Error: ${error.message}`);
  }
}
