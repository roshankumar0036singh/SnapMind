import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { streamToTerminal } from '../utils/streamer.js';
import { resolveNamespace, getVectorStore, personaSearch } from '../utils/vector_storage.js';
import { loadSessionForPath, saveSession } from '../utils/session.js';
import { showStats } from '../utils/monitor.js';
import { handleError } from '../utils/errors.js';
import { handleCommonCommands } from '../utils/commands.js';
import { DEFAULT_PERSONA_CONFIG } from '../utils/persona_store.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

export async function startCustomPersona(persona, options = {}) {
  // Merge with defaults
  const config = { ...DEFAULT_PERSONA_CONFIG, ...persona };
  const color = chalk.hex(config.color || '#00d4ff');
  
  console.log(color(`\n${config.icon} SnapMind: ${config.displayName}`));
  console.log(chalk.gray(`${config.greeting}\n`));

  let targetPath = options.mount;
  if (!targetPath) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select a data source:',
        choices: [
          { name: '📂 Scan Current Folder (.)', value: 'current' },
          { name: '🔌 Mount External Directory', value: 'mount' },
          { name: '📄 Select Specific File', value: 'file' },
          { name: '🏠 Exit to Menu', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') return;
    if (action === 'current') targetPath = '.';
    else if (action === 'mount') {
      const { path: customPath } = await inquirer.prompt([
        { type: 'input', name: 'path', message: 'Enter absolute path:', validate: (input) => fs.pathExists(input) || 'Path does not exist' }
      ]);
      targetPath = customPath;
    } else if (action === 'file') {
      const { path: filePath } = await inquirer.prompt([
        { 
          type: 'input', 
          name: 'path', 
          message: `Enter path to file (${config.fileTypes.join(', ')}):`, 
          validate: (input) => (config.fileTypes.some(ext => input.endsWith(ext)) && fs.pathExists(input)) || 'Invalid file path or type' 
        }
      ]);
      targetPath = filePath;
    }
  }

  try {
    const namespace = await resolveNamespace(targetPath);
    const embeddings = await getEmbeddings(options);
    const vectorStore = await getVectorStore(namespace, embeddings);
    const llm = await getLLM(options);
    let history = options.history || [];
    let focusLens = null;

    const existingHistory = await loadSessionForPath(targetPath);
    if (existingHistory.length > 0) {
      const { resume } = await inquirer.prompt([{ type: 'confirm', name: 'resume', message: 'Resume previous session?', default: true }]);
      if (resume) history = existingHistory;
    }

    if (!vectorStore.table) {
      const spinner = ora('Indexing knowledge...').start();
      try {
        const stats = await fs.stat(targetPath);
        let loader;

        const loaders = {
          '.pdf': (p) => new PDFLoader(p),
          '.csv': (p) => new CSVLoader(p),
          '.txt': (p) => new TextLoader(p),
          '.md': (p) => new TextLoader(p),
          '.js': (p) => new TextLoader(p),
          '.ts': (p) => new TextLoader(p),
          '.py': (p) => new TextLoader(p),
        };

        const supportedLoaders = {};
        config.fileTypes.forEach(ext => {
           if (loaders[ext]) supportedLoaders[ext] = loaders[ext];
        });

        if (stats.isDirectory()) {
          loader = new DirectoryLoader(targetPath, supportedLoaders, true);
        } else {
          const ext = path.extname(targetPath);
          if (supportedLoaders[ext]) {
            loader = supportedLoaders[ext](targetPath);
          } else {
             loader = new TextLoader(targetPath); // Fallback
          }
        }

        const rawDocs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap });
        const docs = await splitter.splitDocuments(rawDocs);
        
        await vectorStore.addDocuments(docs);
        spinner.succeed(`Success! Indexed ${docs.length} semantic chunks.`);
      } catch (error) {
        spinner.fail('Indexing failed.');
        handleError(error);
        return;
      }
    }

    while (true) {
      try {
        const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: color(`${config.name}>`) }]);
        if (query.toLowerCase() === 'exit') break;

        // Shared Commands
        const cmdResult = await handleCommonCommands(query, { history, namespace, llm, currentFocus: focusLens });
        if (cmdResult.collaborate) {
          return { collaborate: cmdResult.collaborate, history, mount: targetPath };
        }
        if (cmdResult.handled) {
          focusLens = cmdResult.focusLens;
          continue;
        }

        // Custom Commands defined in persona
        if (config.commands && config.commands.some(c => query.startsWith(`/${c.name}`))) {
           const cmd = config.commands.find(c => query.startsWith(`/${c.name}`));
           console.log(chalk.cyan(`\nExecuting built-in action: ${cmd.description}\n`));
           // For now, custom commands just trigger a specialized prompt
           const prompt = `Action: ${cmd.name}. Task: ${query.replace(`/${cmd.name}`, '').trim()}`;
           const chatSpinner = ora('Processing action...').start();
           const results = await personaSearch(vectorStore, query, config.similarityK);
           const context = results.map(r => r.pageContent).join('\n---\n');
           chatSpinner.stop();
           const stream = await llm.stream([
             ['system', config.systemPrompt + (focusLens ? `\nFOCUS: ${focusLens}` : '')],
             ['user', `Context:\n${context}\n\nTask: ${prompt}`]
           ]);
           await streamToTerminal(stream, config.color);
           continue;
        }

        if (query.toLowerCase() === '/handoff') {
          const { target } = await inquirer.prompt([{ type: 'list', name: 'target', message: 'Switch to which persona?', choices: ['scholar', 'coder', 'analyst', 'writer'] }]);
          return { target, history, mount: targetPath };
        }

        const chatSpinner = ora('Thinking...').start();
        try {
          const results = await personaSearch(vectorStore, query, config.similarityK);
          const context = results.map(r => r.pageContent).join('\n---\n');
          chatSpinner.stop();
          const stream = await llm.stream([
            ['system', config.systemPrompt + (focusLens ? `\nFOCUS: ${focusLens}` : '')],
            ['user', `Context:\n${context}\n\nQuestion: ${query}`]
          ]);

          const fullResponse = await streamToTerminal(stream, config.color);
          history.push({ role: 'user', content: query });
          history.push({ role: 'assistant', content: fullResponse });
          await saveSession(namespace, history);
        } catch (e) {
          chatSpinner.stop();
          handleError(e);
        }
      } catch (e) {
        if (e.name === 'ExitPromptError') {
          console.log(chalk.gray('\n  × Shutdown requested. Saving session...'));
          await saveSession(namespace, history);
          process.exit(0);
        }
        throw e;
      }
    }
  } catch (error) {
    handleError(error);
  }
}
