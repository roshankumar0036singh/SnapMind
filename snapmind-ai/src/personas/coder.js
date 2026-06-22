import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { streamToTerminal } from '../utils/streamer.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, getVectorStore, globalSearch, resolveNamespace, personaSearch, retrieveContext } from '../utils/vector_storage.js';
import { loadSessionForPath, saveSession } from '../utils/session.js';
import { showStats } from '../utils/monitor.js';
import { extractCodeBlocks } from '../utils/ast_parser.js';
import { handleCommonCommands } from '../utils/commands.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { setupWatcher } from '../utils/watcher.js';
import { syncRepoIndex } from '../utils/repo_sync.js';
import { buildMessages } from '../utils/memory.js';
import config from '../utils/config.js';
import { apiClient } from '../utils/api_client.js';

async function detectTechStack(dir) {
  const stack = [];
  if (await fs.pathExists(path.join(dir, 'package.json'))) stack.push('Node.js/NPM');
  if (await fs.pathExists(path.join(dir, 'requirements.txt'))) stack.push('Python/Pip');
  if (await fs.pathExists(path.join(dir, 'go.mod'))) stack.push('Go');
  if (await fs.pathExists(path.join(dir, 'Cargo.toml'))) stack.push('Rust');
  return stack.length > 0 ? stack.join(', ') : 'Generic Codebase';
}

const { CHUNK_SIZE, CHUNK_OVERLAP, SIMILARITY_K } = NLP_CONFIG.CODER;

export async function startCoder(options = {}) {
  console.log(chalk.blue('\n💻 SnapMind Coder Mode'));
  console.log(chalk.gray('Tips: Use --repo <url> for GitHub or --mount <dir> for local projects.\n'));

  let targetPath = options.mount || '.';
  let repoUrl = options.repo;

  if (!options.repo && !options.mount) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to start?',
        choices: [
          { name: '📂 Scan Current Directory (.)', value: 'current' },
          { name: '🔌 Mount External folder (Absolute Path)', value: 'mount' },
          { name: '🌐 Clone GitHub Repository', value: 'repo' },
          { name: '🏠 Exit to Menu', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') return;
    if (action === 'mount') {
      const { path: customPath } = await inquirer.prompt([
        { type: 'input', name: 'path', message: 'Enter absolute path to folder:', validate: (input) => fs.pathExists(input) || 'Path does not exist' }
      ]);
      targetPath = customPath;
    } else if (action === 'repo') {
      const { url } = await inquirer.prompt([
        { type: 'input', name: 'url', message: 'Enter GitHub Repository URL:', validate: (input) => input.endsWith('.git') || 'Invalid git URL' }
      ]);
      repoUrl = url;
    }
  }

  const namespace = await resolveNamespace(repoUrl || targetPath);
  const git = simpleGit();
  let remoteSessionId = null;

  try {
    const embeddings = await getEmbeddings(options);
    const vectorStore = await getVectorStore(namespace, embeddings);
    const llm = await getLLM(options);
    let history = [];
    const mode = config.get('mode') || 'local';
    const useRemoteRag = mode === 'remote';

    const existingHistory = await loadSessionForPath(repoUrl || targetPath);
    if (existingHistory.length > 0) {
      const { resume } = await inquirer.prompt([{
        type: 'confirm',
        name: 'resume',
        message: `Found a previous session for this codebase. Resume?`,
        default: true
      }]);
      if (resume) history = existingHistory;
    }

    if (!vectorStore.table && !useRemoteRag) {
      if (repoUrl) {
        const repoName = repoUrl.split('/').pop().replace('.git', '');
        targetPath = path.join(process.cwd(), 'snapmind_repos', repoName);
        
        const spinner = ora(`Cloning ${repoUrl}...`).start();
        await fs.ensureDir(path.dirname(targetPath));
        if (await fs.pathExists(targetPath)) {
          spinner.text = 'Repo already exists, updating...';
          await git.cwd(targetPath).pull();
        } else {
          await git.clone(repoUrl, targetPath);
        }
        spinner.succeed(`Clone complete: ${repoName}`);
      }

      const indexSpinner = ora('Indexing codebase locally...').start();
        
        const loader = new DirectoryLoader(targetPath, {
          '.js': (p) => new TextLoader(p),
          '.ts': (p) => new TextLoader(p),
          '.py': (p) => new TextLoader(p),
          '.md': (p) => new TextLoader(p),
          '.json': (p) => new TextLoader(p),
        }, true, 'ignore');
        
          const docs = await loader.load();
          const filteredDocs = docs.filter(d => 
            !d.metadata.source.includes('node_modules') && 
            !d.metadata.source.includes('.git') &&
            !d.metadata.source.includes('.snapmind_cache') &&
            !d.metadata.source.includes('snapmind_repos')
          );

          if (filteredDocs.length === 0) throw new SnapMindError('No supported code files found.', 'EMPTY_CODEBASE');

          const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
          const finalDocs = [];

          for (const doc of filteredDocs) {
            const isJS = doc.metadata.source.endsWith('.js') || doc.metadata.source.endsWith('.ts');
            if (isJS) {
              const blocks = extractCodeBlocks(doc.pageContent, doc.metadata.source);
              if (blocks.length > 0) {
                blocks.forEach(block => {
                  finalDocs.push({
                    pageContent: block.content,
                    metadata: { ...doc.metadata, blockName: block.name, blockType: block.type }
                  });
                });
                continue;
              }
            }
            // Fallback to text splitting
            const chunks = await splitter.splitDocuments([doc]);
            finalDocs.push(...chunks);
          }
          
          await vectorStore.addDocuments(finalDocs);
          indexSpinner.succeed(`Analyzed ${filteredDocs.length} files (${finalDocs.length} snippets).`);
    } else if (useRemoteRag && repoUrl && !vectorStore.table) {
      const remoteSpinner = ora('[Remote] Delegating GitHub synthesis to Neural Core...').start();
      try {
        const ingestResult = await apiClient.ingestGithub(repoUrl, 'auto', remoteSessionId);
        remoteSessionId = ingestResult.session_id || ingestResult.sessionId || null;
        remoteSpinner.succeed('Repository delegated to backend. Chat will use remote neural search.');
        targetPath = repoUrl;
      } catch (e) {
        remoteSpinner.fail('Remote delegation failed.');
        throw e;
      }
    }

    if (options.watch) {
      setupWatcher(targetPath, async (event, filePath) => {
        if (event === 'unlink') {
          await vectorStore.deleteDocumentsBySource(filePath);
        } else {
          try {
            const loader = new TextLoader(filePath);
            const rawDocs = await loader.load();
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 200 });
            const newDocs = await splitter.splitDocuments(rawDocs);
            
            // Remove old
            await vectorStore.deleteDocumentsBySource(filePath);
            // Add new
            await vectorStore.addDocuments(newDocs);
          } catch (e) {
            // Ignore temporary file errors
          }
        }
      });
    }
    
    while (true) {
      let query;
      try {
        const answers = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.blue('coder>') }]);
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
            ['system', `You are SnapMind Coder. Expert in cross-repo logic. Answer using GLOBAL context and codebase context.`],
            ['user', `Global Context:\n${globalContext}\n\nTask: ${subQuery}`]
          ]);
          await streamToTerminal(stream, 'cyan');
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
          choices: ['scholar', 'analyst', 'writer']
        }]);
        return { target, history, mount: targetPath };
      }

      if (query.startsWith('/skill')) {
        const script = query.split(' ')[1];
        if (!script || !/^[a-zA-Z0-9:-]+$/.test(script)) {
          console.log(chalk.yellow('\nUsage: /skill <script_name> (e.g., /skill test, /skill lint)'));
          console.log(chalk.red('Only alphanumeric characters, colons, and hyphens are allowed.'));
          continue;
        }
        
        const skillSpinner = ora(`Executing skill: ${script}...`).start();
        try {
          const stdout = execSync(`npm run ${script}`, { cwd: targetPath, stdio: 'pipe' }).toString();
          skillSpinner.succeed(`Skill completed: ${script}`);
          console.log(chalk.gray(stdout.slice(0, 500) + '...'));
        } catch (e) {
          skillSpinner.fail(`Skill failed: ${script}`);
          console.error(chalk.red(e.stdout ? e.stdout.toString() : e.message));
        }
        continue;
      }

      if (query.toLowerCase() === '/stats') {
        await showStats();
        continue;
      }

      if (query.toLowerCase() === '/sync') {
        const syncSpinner = ora('Syncing git changes into index...').start();
        try {
          const result = await syncRepoIndex(targetPath, vectorStore);
          if (!result.synced) {
            syncSpinner.warn(result.reason || 'Sync skipped.');
          } else {
            syncSpinner.succeed(`Synced ${result.updated} file(s), removed ${result.removed}.`);
          }
        } catch (e) {
          syncSpinner.fail('Repo sync failed.');
          handleError(e);
        }
        continue;
      }

      // /export handled by handleCommonCommands


      if (query.toLowerCase() === '/diagram') {
        const diagramSpinner = ora('Generating architecture diagram...').start();
        try {
          const archResults = await personaSearch(vectorStore, 'main entry point, app structure, core modules, architecture', 10);
          const archContext = archResults.map(r => `File: ${path.relative(targetPath, r.metadata.source)}\nContent:\n${r.pageContent}`).join('\n\n---\n\n');
          
          const response = await llm.invoke([
            ['system', 'You are a Software Architect. Generate a Mermaid.js class or flow diagram representing the system architecture. Only output the Mermaid code block.'],
            ['user', `Visualize this codebase:\n${archContext}`]
          ]);

          const mmdMatch = response.content.match(/```mermaid([\s\S]*?)```/) || response.content.match(/```([\s\S]*?)```/);
          const mmdCode = mmdMatch ? mmdMatch[1].trim() : response.content;
          
          const archFile = path.join(targetPath, 'ARCHITECTURE.md');
          const archContent = `# System Architecture\n\nGenerated by SnapMind AI\n\n\`\`\`mermaid\n${mmdCode}\n\`\`\`\n`;
          await fs.writeFile(archFile, archContent);
          
          const { embed } = await inquirer.prompt([
            { type: 'confirm', name: 'embed', message: 'Would you like to embed this diagram in your README.md?', default: false }
          ]);

          if (embed) {
            const readmePath = path.join(targetPath, 'README.md');
            if (await fs.pathExists(readmePath)) {
              let readme = await fs.readFile(readmePath, 'utf8');
              if (readme.includes('## System Architecture')) {
                 // Replace existing
                 readme = readme.replace(/## System Architecture[\s\S]*?(?=(?:##|$))/, `## System Architecture\n\n\`\`\`mermaid\n${mmdCode}\n\`\`\`\n\n`);
              } else {
                 readme += `\n\n## System Architecture\n\n\`\`\`mermaid\n${mmdCode}\n\`\`\`\n`;
              }
              await fs.writeFile(readmePath, readme);
              diagramSpinner.succeed(`Diagram embedded in ${chalk.bold('README.md')}`);
            } else {
              diagramSpinner.warn('README.md not found, skipped embedding.');
            }
          } else {
            diagramSpinner.succeed(`Architecture diagram saved to ${chalk.bold('ARCHITECTURE.md')}`);
          }
          continue;
        } catch (e) {
          diagramSpinner.fail('Diagram generation failed.');
          handleError(e);
          continue;
        }
      }

      const chatSpinner = ora('Analyzing logic...').start();
      try {
        const results = useRemoteRag
          ? await retrieveContext(query, namespace, embeddings, SIMILARITY_K, { session_id: remoteSessionId })
          : await personaSearch(vectorStore, query, SIMILARITY_K);
        // Deduplicate snippets by source
        const context = [...new Set(results.map(r => `File: ${r.metadata.source}\nContent: ${r.pageContent}`))].join('\n---\n');
        
        const stack = await detectTechStack(targetPath);
        chatSpinner.stop();
        const messages = buildMessages({
          system: `You are SnapMind Coder. Expert in ${stack}. Answer based on the codebase context provided.\nAnalyze logic, find bugs, and suggest improvements.`,
          history,
          user: `Context:\n${context}\n\nQuestion/Task: ${query}`,
        });
        const stream = await llm.stream(messages);

        const fullResponse = await streamToTerminal(stream, 'cyan');

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
