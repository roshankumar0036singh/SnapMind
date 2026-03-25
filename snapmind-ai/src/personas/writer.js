import { WebBaseLoader } from '@langchain/community/document_loaders/web/web_base';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getLLM } from '../utils/llm.js';
import { getKey } from '../utils/credentials.js';
import config from '../utils/config.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { exportSession } from '../utils/exporter.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export async function startWriter(options = {}) {
  console.log(chalk.magenta('\n✍️ SnapMind Writer Mode'));
  console.log(chalk.gray('Tips: Provide URLs to synthesize research. Use /export to save your draft. \n'));

  const { urls } = await inquirer.prompt([
    {
      type: 'input',
      name: 'urls',
      message: 'Enter URLs (separated by spaces):',
      validate: (input) => input.length > 0 || 'Please provide at least one URL',
    },
  ]);

  const urlList = urls.split(' ').filter(u => u.startsWith('http'));
  const spinner = ora(`Scraping ${urlList.length} sources...`).start();
  
  try {
    const loader = new WebBaseLoader(urlList);
    const rawDocs = await loader.load();
    
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 200 });
    const docs = await splitter.splitDocuments(rawDocs);
    
    // Embeddings
    const provider = config.get('provider');
    let embeddings;
    if (provider === 'ollama' && !options.airgap) {
      embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
    } else if (provider === 'openai') {
      embeddings = new OpenAIEmbeddings({ apiKey: await getKey('openai') });
    } else {
      embeddings = new MistralAIEmbeddings({ apiKey: await getKey('mistral') });
    }
    
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
        const results = await vectorStore.similaritySearch(query, 6);
        const context = results.map(r => `Source: ${r.metadata.source}\nContent: ${r.pageContent}`).join('\n\n---\n\n');
        
        const response = await llm.invoke([
          ['system', 'You are SnapMind Writer, a professional content strategist. \nUse the provided research snippets to generate high-quality outlines, drafts, and comparisons.'],
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
