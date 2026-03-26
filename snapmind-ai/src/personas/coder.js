import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { NLP_CONFIG } from '../utils/constants.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, loadVectorStore, saveVectorStore } from '../utils/vector_storage.js';
import { exportSession } from '../utils/exporter.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { setupWatcher } from '../utils/watcher.js';

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

  const namespace = generateNamespace(repoUrl || targetPath);
  const git = simpleGit();

  try {
    const embeddings = await getEmbeddings(options);
    let vectorStore = await loadVectorStore(namespace, embeddings);

    if (!vectorStore) {
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

      const indexSpinner = ora('Indexing codebase...').start();
      
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
        const splitDocs = await splitter.splitDocuments(filteredDocs);
        
        vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
      await saveVectorStore(vectorStore, namespace);
      indexSpinner.succeed(`Analyzed ${filteredDocs.length} files (${docs.length} snippets).`);
    }

    if (options.watch) {
      setupWatcher(targetPath, async (event, filePath) => {
        if (event === 'unlink') {
          vectorStore.memoryVectors = vectorStore.memoryVectors.filter(v => v.metadata.source !== filePath);
        } else {
          try {
            const loader = new TextLoader(filePath);
            const rawDocs = await loader.load();
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 200 });
            const newDocs = await splitter.splitDocuments(rawDocs);
            
            // Remove old
            vectorStore.memoryVectors = vectorStore.memoryVectors.filter(v => v.metadata.source !== filePath);
            // Add new
            await vectorStore.addDocuments(newDocs);
            await saveVectorStore(vectorStore, namespace);
          } catch (e) {
            // Ignore temporary file errors
          }
        }
      });
    }
    
    const llm = await getLLM(options);
    const history = [];

    while (true) {
      const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.blue('coder>') }]);
      if (query.toLowerCase() === 'exit') break;

      if (query.toLowerCase() === '/export') {
        await exportSession(history);
        continue;
      }

      if (query.toLowerCase() === '/diagram') {
        const diagramSpinner = ora('Generating architecture diagram...').start();
        try {
          const archResults = await vectorStore.similaritySearch('main entry point, app structure, core modules, architecture', 10);
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

      const chatSpinner = ora('Scanning logic...').start();
      try {
        const results = await vectorStore.similaritySearch(query, SIMILARITY_K);
        const context = results.map(r => `File: ${path.relative(targetPath, r.metadata.source)}\nContent:\n${r.pageContent}`).join('\n\n---\n\n');
        
        const response = await llm.invoke([
          ['system', 'You are SnapMind Coder. Analyze the snippets and provide concise, technical answers.'],
          ['user', `Context:\n${context}\n\nQuestion: ${query}`]
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
    handleError(error);
  }
}
