import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { streamToTerminal } from '../utils/streamer.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, getVectorStore, globalSearch, resolveNamespace, personaSearch } from '../utils/vector_storage.js';
import { loadSessionForPath, saveSession } from '../utils/session.js';
import { showStats } from '../utils/monitor.js';
import { getTheme } from '../utils/themes.js';
import { handleCommonCommands } from '../utils/commands.js';
import config from '../utils/config.js';
import { apiClient } from '../utils/api_client.js';
import { LANCE_DIR } from '../utils/paths.js';
import * as lancedb from '@lancedb/lancedb';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
const { CHUNK_SIZE, CHUNK_OVERLAP, SIMILARITY_K } = NLP_CONFIG.WRITER;

export async function startWriter(options = {}) {
  const theme = getTheme();
  console.log(theme.writer('\n✍️ SnapMind Writer Mode'));
  console.log(theme.secondary('Tips: Pass URLs or text files to synthesize content.\n'));

  let targetPath;
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select a data source for your draft:',
      choices: [
        { name: '🌐 Live Web Scraping (URLs)', value: 'urls' },
        { name: '📄 Local Text/MD Files', value: 'files' },
        { name: '🏠 Exit to Menu', value: 'exit' }
      ]
    }
  ]);

  if (action === 'exit') return;

  let docs = [];
  const mode = config.get('mode') || 'local';

  if (action === 'urls') {
    const { urls } = await inquirer.prompt([{ type: 'input', name: 'urls', message: 'Enter URLs (space separated):' }]);
    const urlList = urls.split(' ').filter(u => u.startsWith('http'));
    
    if (mode === 'remote') {
      const remoteSpinner = ora(`[Remote] Triggering backend pulse for ${urlList.length} sources...`).start();
      try {
        for (const url of urlList) {
          await apiClient.ingestWebsite(url, 'auto');
        }
        remoteSpinner.succeed('Backend ingestion synchronized. Live updates will reflect in the Atlas.');
        targetPath = 'remote_session';
      } catch (e) {
        remoteSpinner.fail('Remote ingestion request failed.');
        throw e;
      }
    } else {
      const scrapeSpinner = ora('Scraping web content locally...').start();
      for (const url of urlList) {
        const loader = new CheerioWebBaseLoader(url);
        docs.push(...await loader.load());
      }
      scrapeSpinner.succeed(`Scraped ${docs.length} pages.`);
      targetPath = urls;
    }
  } else if (action === 'files') {
    const { source } = await inquirer.prompt([
      {
        type: 'list',
        name: 'source',
        message: 'Load text from:',
        choices: [
          { name: '📂 Current folder (.)', value: 'current' },
          { name: '📄 Specific file or folder path', value: 'path' },
        ],
      },
    ]);

    if (source === 'current') {
      targetPath = '.';
    } else {
      const { filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: 'Enter path to file or folder:',
          validate: (input) => fs.pathExists(input) || 'Path does not exist',
        },
      ]);
      targetPath = filePath;
    }

    const loadSpinner = ora('Loading local text files...').start();
    try {
      const stats = await fs.stat(targetPath);
      if (stats.isDirectory()) {
        const loader = new DirectoryLoader(
          targetPath,
          {
            '.txt': (p) => new TextLoader(p),
            '.md': (p) => new TextLoader(p),
          },
          true
        );
        docs = await loader.load();
      } else {
        docs = await new TextLoader(targetPath).load();
      }

      if (docs.length === 0) {
        throw new SnapMindError('No .txt or .md files found at the selected path.', 'EMPTY_SOURCE');
      }
      loadSpinner.succeed(`Loaded ${docs.length} document(s).`);
    } catch (error) {
      loadSpinner.fail('Failed to load local files.');
      handleError(error);
      return;
    }
  }

  const { tone } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tone',
      message: 'Select writing tone:',
      choices: ['Professional', 'Creative', 'Technical', 'Academic', 'Concise'],
      default: 'Professional'
    }
  ]);

  try {
    const namespace = await resolveNamespace(targetPath || 'default_writer');
    const embeddings = await getEmbeddings(options);
    const vectorStore = await getVectorStore(namespace, embeddings);
    const llm = await getLLM(options);
    let history = options.history || [];
    let currentResults = [];

    const existingHistory = await loadSessionForPath(targetPath || 'default_writer');
    if (existingHistory.length > 0) {
      const { resume } = await inquirer.prompt([{
        type: 'confirm',
        name: 'resume',
        message: `Found a previous drafting session. Resume?`,
        default: true
      }]);
      if (resume) history = existingHistory;
    }

    if (!vectorStore.table && docs.length > 0) {
      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
      const splitDocs = await splitter.splitDocuments(docs);
      await vectorStore.addDocuments(splitDocs);
    }

    while (true) {
      let query;
      try {
        const answers = await inquirer.prompt([{ type: 'input', name: 'query', message: theme.writer('writer>') }]);
        query = answers.query;
      } catch (e) {
        if (e.name === 'ExitPromptError') {
          console.log(chalk.gray('\n  × Shutdown requested. Saving session...'));
          await saveSession(namespace, history);
          process.exit(0);
        }
        throw e;
      }

      if (query.toLowerCase() === 'exit') break;

      // Shared Commands
      const cmdResult = await handleCommonCommands(query, { history, namespace, llm, currentFocus: null });
      if (cmdResult.collaborate) {
        return { collaborate: cmdResult.collaborate, history, mount: targetPath };
      }
      if (cmdResult.handled) continue;

      if (query.startsWith('/global')) {
        const subQuery = query.replace('/global', '').trim();
        const globalSpinner = ora('Relational RAG: Searching across all datasets...').start();
        try {
          const globalResults = await globalSearch(subQuery, embeddings, 5);
          globalSpinner.stop();
          const globalContext = globalResults.map(r => `[GLOBAL] Source: ${r.namespace}\nContent: ${r.pageContent}`).join('\n\n---\n\n');
          
          const stream = await llm.stream([
            ['system', 'You are SnapMind Writer. Synthesize GLOBAL research content.'],
            ['user', `Global Context:\n${globalContext}\n\nTask: ${subQuery}`]
          ]);
          await streamToTerminal(stream, 'magenta');
        } catch (e) {
          globalSpinner.fail('Global search failed.');
          handleError(e);
        }
        continue;
      }

      if (query.toLowerCase() === '/handoff') {
        const { target } = await inquirer.prompt([{
          type: 'list',
          name: 'target',
          message: 'Handoff to which Intelligence Architecture?',
          choices: ['scholar', 'analyst', 'coder']
        }]);
        return { target, history, mount: targetPath };
      }

      if (query.startsWith('/snapshot')) {
        const name = query.split(' ')[1] || 'default';
        await saveSession(namespace, history, name);
        console.log(theme.success(`\n📸 Snapshot saved as: ${chalk.bold(name)}`));
        continue;
      }

      if (query.toLowerCase() === '/stats') {
        await showStats();
        continue;
      }

      if (query.toLowerCase() === '/import') {
        const db = await lancedb.connect(LANCE_DIR);
        const namespaces = (await db.tableNames()).filter((n) => n !== namespace);
        if (namespaces.length === 0) {
          console.log(chalk.yellow('\nNo other indexed datasets available to import.\n'));
          continue;
        }

        const { choice } = await inquirer.prompt([{
          type: 'list',
          name: 'choice',
          message: 'Select research to import:',
          choices: namespaces,
        }]);
        
        const importSpinner = ora(`Importing ${choice}...`).start();
        const otherStore = await getVectorStore(choice, embeddings);
        const otherDocs = await personaSearch(otherStore, 'summary overview content', 20);
        await vectorStore.addDocuments(otherDocs.map(d => ({ pageContent: d.pageContent, metadata: { ...d.metadata, importedFrom: choice } })));
        importSpinner.succeed(`Imported context from ${choice}.`);
        continue;
      }

      // /export handled by handleCommonCommands


      const chatSpinner = ora('Synthesizing...').start();
      try {
        const results = await personaSearch(vectorStore, query, SIMILARITY_K);
        const context = results.map(r => `Source: ${r.metadata.source}\nContent: ${r.pageContent}`).join('\n\n---\n\n');
        
        chatSpinner.stop();
        const stream = await llm.stream([
          ['system', `You are SnapMind Writer. TONE: ${tone}. Use the context to synthesize drafts, outlines, or summaries.`],
          ['user', `Context:\n${context}\n\nTask: ${query}`]
        ]);

        const fullResponse = await streamToTerminal(stream, 'magenta');
        history.push({ role: 'user', content: query });
        history.push({ role: 'assistant', content: fullResponse });
        await saveSession(namespace, history);
      } catch (e) {
        chatSpinner.stop();
        handleError(e);
      }
    }
  } catch (error) {
    handleError(error);
  }
}
