import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { OllamaEmbeddings } from '@langchain/ollama';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getLLM } from '../utils/llm.js';
import { getKey } from '../utils/credentials.js';
import config from '../utils/config.js';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, loadVectorStore, saveVectorStore } from '../utils/vector_storage.js';
import { exportSession } from '../utils/exporter.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';

export async function startCoder(options = {}) {
  console.log(chalk.blue('\n💻 SnapMind Coder Mode'));
  console.log(chalk.gray('Tips: Use --repo <url> for GitHub or --mount <dir> for local projects.\n'));

  let targetPath = options.mount || '.';
  const namespace = generateNamespace(options.repo || targetPath);
  const git = simpleGit();

  try {
    const provider = config.get('provider');
    let embeddings;
    if (provider === 'ollama' && !options.airgap) {
      embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
    } else if (provider === 'openai') {
      embeddings = new OpenAIEmbeddings({ apiKey: await getKey('openai') });
    } else {
      embeddings = new MistralAIEmbeddings({ apiKey: await getKey('mistral') });
    }

    let vectorStore = await loadVectorStore(namespace, embeddings);

    if (!vectorStore) {
      if (options.repo) {
        const repoName = options.repo.split('/').pop().replace('.git', '');
        targetPath = path.join(process.cwd(), 'snapmind_repos', repoName);
        
        const spinner = ora(`Cloning ${options.repo}...`).start();
        await fs.ensureDir(path.dirname(targetPath));
        if (await fs.pathExists(targetPath)) {
          spinner.text = 'Repo already exists, updating...';
          await git.cwd(targetPath).pull();
        } else {
          await git.clone(options.repo, targetPath);
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
      
      const rawDocs = await loader.load();
      const filteredDocs = rawDocs.filter(d => 
        !d.metadata.source.includes('node_modules') && 
        !d.metadata.source.includes('.git') &&
        !d.metadata.source.includes('snapmind_repos')
      );

      if (filteredDocs.length === 0) throw new SnapMindError('No supported code files found.', 'EMPTY_CODEBASE');

      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 200 });
      const docs = await splitter.splitDocuments(filteredDocs);
      
      vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      await saveVectorStore(vectorStore, namespace);
      indexSpinner.succeed(`Analyzed ${filteredDocs.length} files (${docs.length} snippets).`);
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
          
          diagramSpinner.succeed(`Architecture diagram saved to ${chalk.bold('ARCHITECTURE.md')}`);
          continue;
        } catch (e) {
          diagramSpinner.fail('Diagram generation failed.');
          handleError(e);
          continue;
        }
      }

      const chatSpinner = ora('Scanning logic...').start();
      try {
        const results = await vectorStore.similaritySearch(query, 4);
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
