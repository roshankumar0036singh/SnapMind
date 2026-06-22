import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { streamToTerminal } from '../utils/streamer.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { getVectorStore, globalSearch, resolveNamespace, personaSearch } from '../utils/vector_storage.js';
import { loadSessionForPath, saveSession } from '../utils/session.js';
import { showStats } from '../utils/monitor.js';
import { renderLineChart } from '../utils/charts.js';
import { handleCommonCommands } from '../utils/commands.js';
import { loadAnalystDocuments, isAnalystDataFile, reindexAnalystFile, ANALYST_EXTENSIONS } from '../utils/data_loaders.js';
import { setupWatcher } from '../utils/watcher.js';
import { buildMessages } from '../utils/memory.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

const { SIMILARITY_K } = NLP_CONFIG.ANALYST;
const EXT_LABEL = ANALYST_EXTENSIONS.join(', ');

export async function startAnalyst(options = {}) {
  console.log(chalk.green('\n📊 SnapMind Analyst Mode'));
  console.log(chalk.gray(`Tips: Load ${EXT_LABEL} files to query trends. Use /export to save results.\n`));

  let targetPath = options.mount;

  if (!targetPath) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select a data source for analysis:',
        choices: [
          { name: '📄 Select Specific Data File', value: 'file' },
          { name: '📂 Scan Current Folder (.)', value: 'current' },
          { name: '🔌 Mount External Folder (Absolute Path)', value: 'mount' },
          { name: '🏠 Exit to Menu', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') return;
    if (action === 'file') {
      const { path: filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: `Enter path to data file (${EXT_LABEL}):`,
          validate: (input) => isAnalystDataFile(input) && fs.pathExists(input) || `Invalid path. Supported: ${EXT_LABEL}`,
        },
      ]);
      targetPath = filePath;
    } else if (action === 'current') {
      targetPath = '.';
    } else if (action === 'mount') {
      const { path: customPath } = await inquirer.prompt([
        { type: 'input', name: 'path', message: 'Enter absolute path to folder:', validate: (input) => fs.pathExists(input) || 'Path does not exist' },
      ]);
      targetPath = customPath;
    }
  }

  try {
    const namespace = await resolveNamespace(targetPath);
    const embeddings = await getEmbeddings(options);
    const vectorStore = await getVectorStore(namespace, embeddings);
    const llm = await getLLM(options);
    let history = options.history || [];

    const existingHistory = await loadSessionForPath(targetPath);
    if (existingHistory.length > 0) {
      const { resume } = await inquirer.prompt([{
        type: 'confirm',
        name: 'resume',
        message: 'Found a previous session for this dataset. Resume?',
        default: true,
      }]);
      if (resume) history = existingHistory;
    }

    if (!vectorStore.table) {
      const spinner = ora('Parsing data and building index...').start();
      try {
        const docs = await loadAnalystDocuments(targetPath);
        await vectorStore.addDocuments(docs);
        spinner.succeed(`Success! Indexed ${docs.length} rows of data.`);
      } catch (error) {
        spinner.fail('Data loading failed.');
        handleError(error);
        return;
      }
    }

    const watchPath = options.watch || targetPath;
    if (options.watch) {
      setupWatcher(watchPath, async (event, filePath) => {
        if (!isAnalystDataFile(filePath)) return;
        if (event === 'unlink') {
          await vectorStore.deleteDocumentsBySource(filePath, { prefix: true });
          return;
        }
        try {
          await reindexAnalystFile(vectorStore, filePath);
        } catch {
          // Ignore transient file read errors during sync.
        }
      });
    }

    while (true) {
      let query;
      try {
        const answers = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.green('analyst>') }]);
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
            ['system', 'You are SnapMind Analyst. Use GLOBAL data context to answer query.'],
            ['user', `Global Context:\n${globalContext}\n\nTask: ${subQuery}`],
          ]);
          await streamToTerminal(stream, 'green');
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
          choices: ['scholar', 'coder', 'writer'],
        }]);
        return { target, history, mount: targetPath };
      }

      if (query.toLowerCase() === '/stats') {
        await showStats();
        continue;
      }

      if (query.toLowerCase() === '/chart') {
        const chartSpinner = ora('Extracting trend data...').start();
        try {
          const results = await personaSearch(vectorStore, 'numerical values, dates, counts, prices', 15);
          const dataContext = results.map(r => r.pageContent).join('\n---\n');

          const response = await llm.invoke([
            ['system', 'Extract a single numerical series from the data (e.g. price over time, counts by date). Output ONLY a raw JSON array of numbers. NO text.'],
            ['user', `Data Snippets:\n${dataContext}`],
          ]);

          const data = JSON.parse(response.content.replace(/```json|```/g, '').trim());
          chartSpinner.stop();
          renderLineChart(data, { label: 'Trend Analysis (Last 15 Snippets)' });
          continue;
        } catch (e) {
          chartSpinner.stop();
          handleError(new SnapMindError('Failed to generate chart. Ensure data is numeric.', 'CHART_ERROR'));
          continue;
        }
      }

      if (query.toLowerCase() === '/table') {
        const tableSpinner = ora('Formatting data table...').start();
        try {
          const results = await personaSearch(vectorStore, 'summary, overview, data points', 10);
          const tableContext = results.map(r => r.pageContent).join('\n---\n');

          tableSpinner.stop();
          const stream = await llm.stream([
            ['system', 'Extract the data points from the provided tabular snippets and format them as a clean Markdown table. Only output the table.'],
            ['user', `Data Snippets:\n${tableContext}`],
          ]);

          await streamToTerminal(stream, 'cyan');
          continue;
        } catch (e) {
          tableSpinner.stop();
          handleError(e);
          continue;
        }
      }

      const chatSpinner = ora('Calculating...').start();
      try {
        const results = await personaSearch(vectorStore, query, SIMILARITY_K);
        const context = results.map(r => r.pageContent).join('\n---\n');

        chatSpinner.stop();
        const messages = buildMessages({
          system: 'You are SnapMind Analyst. Answer questions based on the provided tabular data snippets.\nBe precise with numbers and trends.',
          history,
          user: `Data Snippets:\n${context}\n\nQuestion: ${query}`,
        });
        const stream = await llm.stream(messages);

        const fullResponse = await streamToTerminal(stream, 'green');

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
