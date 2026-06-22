import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { handleError, SnapMindError } from '../utils/errors.js';
import { getVectorStore, globalSearch, resolveNamespace, personaSearch } from '../utils/vector_storage.js';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { streamToTerminal } from '../utils/streamer.js';
import { loadSessionForPath, saveSession } from '../utils/session.js';
import { showStats } from '../utils/monitor.js';
import { getTheme } from '../utils/themes.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleCommonCommands } from '../utils/commands.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import config from '../utils/config.js';
import { loadPlugins, runPlugin } from '../utils/plugins.js';
import { setupWatcher } from '../utils/watcher.js';
import { buildMessages } from '../utils/memory.js';
import { assessRetrieval, formatGroundingRefusal } from '../utils/grounding.js';

const { CHUNK_SIZE, CHUNK_OVERLAP, SIMILARITY_K } = NLP_CONFIG.SCHOLAR;

export async function startScholar(options = {}) {
  const theme = getTheme();
  console.log(theme.scholar('\n🎓 SnapMind Scholar Mode'));
  console.log(theme.secondary('Tips: Use --mount <dir> for folders, --watch for live PDF sync.\n'));

  let targetPath = options.mount;
  if (!targetPath) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to start your research?',
        choices: [
          { name: '📂 Scan Current Folder (.)', value: 'current' },
          { name: '🔌 Mount External Directory (Absolute Path)', value: 'mount' },
          { name: '📄 Select Specific PDF File', value: 'file' },
          { name: '🏠 Exit to Menu', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') return;
    if (action === 'current') targetPath = '.';
    else if (action === 'mount') {
      const { path: customPath } = await inquirer.prompt([
        { type: 'input', name: 'path', message: 'Enter absolute path to directory:', validate: (input) => fs.pathExists(input) || 'Path does not exist' }
      ]);
      targetPath = customPath;
    } else if (action === 'file') {
      const { path: filePath } = await inquirer.prompt([
        { type: 'input', name: 'path', message: 'Enter path to PDF file:', validate: (input) => input.endsWith('.pdf') && fs.pathExists(input) || 'Invalid PDF path' }
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
    let currentResults = [];
    let strictGrounding = config.get('citationGrounding') !== false;

    const existingHistory = await loadSessionForPath(targetPath);
    if (existingHistory.length > 0) {
      const { resume } = await inquirer.prompt([{
        type: 'confirm',
        name: 'resume',
        message: `Found a previous session from this source. Resume?`,
        default: true
      }]);
      if (resume) history = existingHistory;
    }
    
    if (!vectorStore.table) {
      const spinner = ora('Loading and indexing knowledge...').start();
      try {
        const stats = await fs.stat(targetPath);
        let loader;

        if (stats.isDirectory()) {
          loader = new DirectoryLoader(targetPath, {
            '.pdf': (p) => new PDFLoader(p),
          }, true); // Recursive
        } else if (targetPath.endsWith('.pdf')) {
          loader = new PDFLoader(targetPath);
        } else {
          throw new SnapMindError('Unsupported file type. Scholar persona requires PDFs.', 'INVALID_FILE');
        }

        let rawDocs = await loader.load();
        
        // Page Range Filtering
        if (options.pages) {
          const [start, end] = options.pages.split('-').map(Number);
          rawDocs = rawDocs.filter(d => {
            const pg = d.metadata?.loc?.pageNumber;
            return pg >= (start || 0) && pg <= (end || Infinity);
          });
        }

        if (rawDocs.length === 0) throw new SnapMindError('No PDF documents found in range.', 'EMPTY_SOURCE');

        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
        const docs = await splitter.splitDocuments(rawDocs);
        
        await vectorStore.addDocuments(docs);
        spinner.succeed(`Ready! Indexed ${docs.length} semantic chunks.`);
      } catch (error) {
        spinner.fail('Indexing failed.');
        handleError(error);
        return;
      }
    }

    const watchPath = options.watch || targetPath;
    if (options.watch) {
      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });

      setupWatcher(watchPath, async (event, filePath) => {
        if (!filePath.toLowerCase().endsWith('.pdf')) return;

        if (event === 'unlink') {
          await vectorStore.deleteDocumentsBySource(filePath);
          return;
        }

        try {
          const rawDocs = await new PDFLoader(filePath).load();
          const docs = await splitter.splitDocuments(rawDocs);
          await vectorStore.deleteDocumentsBySource(filePath);
          if (docs.length > 0) {
            await vectorStore.addDocuments(docs);
          }
        } catch {
          // Ignore transient PDF read errors during sync.
        }
      });
    }

    const plugins = await loadPlugins();

    while (true) {
      let query;
      try {
        const answers = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.yellow('scholar>') }]);
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
            ['system', 'You are SnapMind Scholar. You have access to the GLOBAL knowledge base. Answer the query using both local and global context.'],
            ['user', `Global Context:\n${globalContext}\n\nTask: ${subQuery}`]
          ]);
          await streamToTerminal(stream, 'cyan');
        } catch (e) {
          globalSpinner.fail('Global search failed.');
          handleError(e);
        }
        continue;
      }

      // /export handled by handleCommonCommands
      // /snapshot kept for backward sync and custom names
      if (query.startsWith('/snapshot')) {
        const name = query.split(' ')[1] || 'default';
        await saveSession(namespace, history, name);
        console.log(chalk.green(`\nSnapshot saved as: ${chalk.bold(name)}`));
        continue;
      }

      if (query.startsWith('/diff')) {
        const parts = query.split(' ');
        const nameA = parts[1];
        const nameB = parts[2];
        if (!nameA || !nameB) {
          console.log(chalk.yellow('\nUsage: /diff <snapshot_a> <snapshot_b>'));
          continue;
        }
        const { diffSnapshots } = await import('../utils/diff.js');
        await diffSnapshots(namespace, nameA, nameB);
        continue;
      }

      if (query.toLowerCase() === '/bibtex') {
        const bibSpinner = ora('Generating academic bibliography...').start();
        try {
          // Query LanceDB for all unique sources in this namespace
          const allDocs = await vectorStore.table.query().select(['metadata']).toArray();
          const sources = [...new Set(allDocs.map(d => JSON.parse(d.metadata).source))];
          
          const bibEntries = sources.map(source => {
            const name = path.basename(source, '.pdf');
            const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            return `@article{${key},\n  title={${name}},\n  author={SnapMind Scholar},\n  journal={Indexed PDF},\n  year={${new Date().getFullYear()}}\n}`;
          }).join('\n\n');

          const bibPath = path.join(process.cwd(), `scholar_archive_${namespace.slice(0, 6)}.bib`);
          await fs.writeFile(bibPath, bibEntries);
          bibSpinner.succeed(`Bibliography exported to ${chalk.bold(bibPath)}`);
        } catch (e) {
          bibSpinner.fail('Failed to generate BibTeX.');
          handleError(e);
        }
        continue;
      }
      if (query.startsWith('/cite')) {
        const index = parseInt(query.split(' ')[1]) - 1;
        if (currentResults[index]) {
          const doc = currentResults[index];
          const page = doc.metadata?.loc?.pageNumber || '?';
          const source = path.basename(doc.metadata?.source || 'Unknown');
          console.log(chalk.cyan(`\nFull Citation [Source ${index + 1}]:`));
          console.log(chalk.gray(`  File : ${source}`));
          console.log(chalk.gray(`  Page : ${page}`));
          console.log(chalk.white(`\n${doc.pageContent}\n`));
          console.log(chalk.gray(`  --- [${source}, p.${page}]`));
        } else {
          console.log(chalk.red('Invalid citation index. Use /cite [index] from the previous response.'));
        }
        continue;
      }

      // Plugin system: attempt to run any user plugin
      if (query.startsWith('/')) {
        const handled = await runPlugin(query, { query, history, vectorStore, llm, streamToTerminal }, plugins);
        if (handled) continue;
      }

      if (query.toLowerCase() === '/stats') {
        await showStats();
        continue;
      }

      if (query.toLowerCase() === '/grounding on') {
        strictGrounding = true;
        console.log(chalk.green('\n✅ Citation grounding enabled.\n'));
        continue;
      }
      if (query.toLowerCase() === '/grounding off') {
        strictGrounding = false;
        console.log(chalk.yellow('\n⚠️ Citation grounding disabled.\n'));
        continue;
      }

      const chatSpinner = ora('Researching...').start();
      try {
        const results = await personaSearch(vectorStore, query, SIMILARITY_K);
        currentResults = results;

        if (strictGrounding) {
          const assessment = assessRetrieval(results);
          if (!assessment.ok) {
            chatSpinner.stop();
            console.log(chalk.yellow(`\n${formatGroundingRefusal(assessment.reason)}\n`));
            continue;
          }
        }

        const context = results.map((r, i) => `[Source ${i + 1}] Path: ${path.basename(r.metadata?.source || 'Doc')}\nContent: ${r.pageContent}`).join('\n\n---\n\n');

        const systemPrompt = query.startsWith('/research')
          ? 'You are SnapMind Scholar. This is a DEEP RESEARCH task. Synthesize all sources into a cohesive academic summary. Compare perspectives if they differ.'
          : 'You are SnapMind Scholar. Answer based ONLY on context. Cite page numbers using [Source X] notation. If context is insufficient, say so explicitly.';

        chatSpinner.stop();
        const messages = buildMessages({
          system: systemPrompt,
          history,
          user: `Context:\n${context}\n\nQuestion: ${query.replace('/research', '').trim()}`,
        });
        const stream = await llm.stream(messages);

        const fullResponse = await streamToTerminal(stream, 'cyan');

        history.push({ role: 'user', content: query });
        history.push({ role: 'assistant', content: fullResponse });
        await saveSession(namespace, history);

        console.log(chalk.gray('Sources:'));
        results.forEach((r, i) => {
          const fileName = path.basename(r.metadata?.source || 'Doc');
          console.log(chalk.gray(` [${i + 1}] ${fileName} (Page ${r.metadata?.loc?.pageNumber || '?'})`));
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
