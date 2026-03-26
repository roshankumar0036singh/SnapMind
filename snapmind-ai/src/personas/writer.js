import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { exportSession } from '../utils/exporter.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

const { CHUNK_SIZE, CHUNK_OVERLAP, SIMILARITY_K } = NLP_CONFIG.WRITER;

export async function startWriter(options = {}) {
  console.log(chalk.magenta('\n✍️ SnapMind Writer Mode'));
  console.log(chalk.gray('Tips: Provide URLs to synthesize research. Use /export to save your draft. \n'));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to start your research?',
      choices: [
        { name: '🌐 Enter URLs for Live Scraping', value: 'urls' },
        { name: '🏠 Exit to Menu', value: 'exit' }
      ]
    }
  ]);

  if (action === 'exit') return;

  const { urls } = await inquirer.prompt([
    {
      type: 'input',
      name: 'urls',
      message: 'Enter URLs (separated by spaces):',
      validate: (input) => input.length > 0 || 'Please provide at least one URL',
    },
  ]);

  const { tone } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tone',
      message: 'Select writing tone:',
      choices: ['Professional', 'Creative', 'Technical', 'Academic', 'Concise'],
      default: 'Professional'
    }
  ]);

  const urlList = urls.split(' ').filter(u => u.startsWith('http'));
  const spinner = ora(`Scraping ${urlList.length} sources...`).start();
  
  try {
    const rawDocs = [];
    for (const url of urlList) {
       const sourceLoader = new CheerioWebBaseLoader(url);
       const webDocuments = await sourceLoader.load();
       rawDocs.push(...webDocuments);
    }
    
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
    const docs = await splitter.splitDocuments(rawDocs);
    
    // Embeddings
    const embeddings = await getEmbeddings(options);
    
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    spinner.succeed(`Success! Synthesized research from ${urlList.length} sources.`);
    
    const llm = await getLLM(options);
    const history = [];

    while (true) {
      const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.magenta('writer>') }]);
      if (query.toLowerCase() === 'exit') break;

      if (query.toLowerCase() === '/export') {
        await exportSession(history);
        continue;
      }

      const chatSpinner = ora('Synthesizing...').start();
      try {
        const results = await vectorStore.similaritySearch(query, SIMILARITY_K);
        const context = results.map(r => `Source: ${r.metadata.source}\nContent: ${r.pageContent}`).join('\n\n---\n\n');
        
        const response = await llm.invoke([
          ['system', `You are SnapMind Writer, a professional content strategist. \nUse the provided research snippets to generate high-quality outlines, drafts, and comparisons. \nTONE: ${tone}`],
          ['user', `Research Context:\n${context}\n\nTask: ${query}`]
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
    spinner.fail('Scraping failed.');
    handleError(error);
  }
}
