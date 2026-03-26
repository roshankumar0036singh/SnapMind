import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { handleError, SnapMindError } from '../utils/errors.js';
import { generateNamespace, loadVectorStore, saveVectorStore } from '../utils/vector_storage.js';
import { getLLM, getEmbeddings } from '../utils/llm.js';
import { NLP_CONFIG } from '../utils/constants.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import config from '../utils/config.js';

const { CHUNK_SIZE, CHUNK_OVERLAP, SIMILARITY_K } = NLP_CONFIG.SCHOLAR;

export async function startScholar(options = {}) {
  console.log(chalk.cyan('\n🎓 SnapMind Scholar Mode'));
  console.log(chalk.gray('Tips: Use --mount <dir> for folders or pass a PDF path.\n'));

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
    const namespace = generateNamespace(targetPath);
    const embeddings = await getEmbeddings(options);
    let vectorStore = await loadVectorStore(namespace, embeddings);
    
    if (!vectorStore) {
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
        
        vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
        await saveVectorStore(vectorStore, namespace);
        spinner.succeed(`Ready! Indexed ${docs.length} semantic chunks.`);
      } catch (error) {
        spinner.fail('Indexing failed.');
        handleError(error);
        return;
      }
    }
    
    const llm = await getLLM(options);
    const history = [];
    
    while (true) {
      const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: chalk.yellow('scholar>') }]);
      if (query.toLowerCase() === 'exit') break;

      if (query.toLowerCase() === '/export') {
        await exportSession(history);
        continue;
      }

      if (query.toLowerCase() === '/cite') {
        const citeSpinner = ora('Generating BibTeX citations...').start();
        const sources = [...new Set(vectorStore.memoryVectors.map(v => path.basename(v.metadata?.source || 'document')))];
        const bibtex = sources.map(s => `@article{${s.replace(/\s+/g, '_')},\n  title={${s}},\n  author={SnapMind Scholar},\n  year={${new Date().getFullYear()}}\n}`).join('\n\n');
        
        const bibFile = path.join(path.dirname(targetPath), 'citations.bib');
        await fs.writeFile(bibFile, bibtex);
        citeSpinner.succeed(`Citations saved to ${chalk.bold('citations.bib')}`);
        continue;
      }

      const chatSpinner = ora('Researching...').start();
      try {
        const results = await vectorStore.similaritySearch(query, SIMILARITY_K);
        const context = results.map(r => `Source: ${path.basename(r.metadata?.source || 'Doc')}\nContent: ${r.pageContent}`).join('\n\n');
        
        const systemPrompt = query.startsWith('/research') 
          ? 'You are SnapMind Scholar. This is a DEEP RESEARCH task. Synthesize all sources into a cohesive academic summary. Compare perspectives if they differ.'
          : 'You are SnapMind Scholar. Answer based ONLY on context. Cite page numbers.';

        const response = await llm.invoke([
          ['system', systemPrompt],
          ['user', `Context:\n${context}\n\nQuestion: ${query.replace('/research', '').trim()}`]
        ]);

        chatSpinner.stop();
        console.log(chalk.cyan('\n' + response.content + '\n'));
        
        history.push({ role: 'user', content: query });
        history.push({ role: 'assistant', content: response.content });

        console.log(chalk.gray('Sources:'));
        results.forEach((r, i) => {
          const fileName = path.basename(r.metadata?.source || 'Doc');
          console.log(chalk.gray(` [${i+1}] ${fileName} (Page ${r.metadata?.loc?.pageNumber || '?'})`));
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
