#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
import inquirer from 'inquirer';
import figlet from 'figlet';
import boxen from 'boxen';
import { startMenu } from './cli/menu.js';
import config from './utils/config.js';
import { setKey } from './utils/credentials.js';
import { globalSearch } from './utils/vector_storage.js';
import { getEmbeddings } from './utils/llm.js';



const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

// Graceful Exit on Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.gray('\n\n  × Shutdown requested. Take care of your mind!'));
  process.exit(0);
});

const program = new Command();

program
  .name('snapmind-ai')
  .description('The ultimate local AI companion for students, developers, and analysts.')
  .version('1.0.0')
  .option('--airgap', 'Run in 100% offline mode using local models only')
  .option('--watch <path>', 'Automatically index changes in the specified directory')
  .option('--repo <url>', 'Clone and index a GitHub repository')
  .option('--mount <path>', 'Mount and index a local directory recursively')
  .option('--pages <range>', 'Specific page range to index (e.g., 1-10)')
  .option('--persona <name>', 'Select persona directly (scholar, coder, analyst, writer)');


program
  .command('config')
  .description('Manage SnapMind AI configuration')
  .argument('[action]', 'Action to perform (set, get, list)', 'list')
  .argument('[key]', 'The config key to manage')
  .argument('[value]', 'The value to set')
  .action(async (action, key, value) => {
    if (action === 'set' && key && value) {
      if (key.endsWith('-key')) {
        const provider = key.split('-')[0];
        await setKey(provider, value);
        console.log(chalk.green(`✅ Secured ${provider} key in OS Keychain.`));
      } else {
        config.set(key, value);
        console.log(chalk.green(`✅ Updated ${key} to ${value}`));
      }
    } else if (action === 'get' && key) {
      console.log(config.get(key));
    } else {
      // Interactive Wizard
      console.log(chalk.cyan('\n🛠️ SnapMind Setup Wizard'));
      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'What would you like to configure?',
          choices: [
            { name: 'Change Default Provider', value: 'provider' },
            { name: 'Update API Keys (Secure Keychain)', value: 'keys' },
            { name: 'Adjust Temperature', value: 'temperature' },
            { name: 'View Current Config', value: 'show' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      if (choice === 'provider') {
        const { provider } = await inquirer.prompt([{
          type: 'list',
          name: 'provider',
          message: 'Select default AI provider:',
          choices: ['ollama', 'openai', 'mistral', 'anthropic', 'gemini']
        }]);
        config.set('provider', provider);
        console.log(chalk.green(`✅ Default provider set to ${provider}`));
      } else if (choice === 'keys') {
        const { provider } = await inquirer.prompt([{
          type: 'list',
          name: 'provider',
          message: 'Select provider to update key for:',
          choices: ['openai', 'mistral', 'anthropic', 'gemini']
        }]);
        const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: `Enter API key for ${provider}:`, mask: '*' }]);
        await setKey(provider, key);
        console.log(chalk.green('✅ Key securely stored.'));
      } else if (choice === 'temperature') {
        const { temp } = await inquirer.prompt([{ type: 'number', name: 'temp', message: 'Enter temperature (0.0 - 1.0):', default: config.get('temperature') }]);
        config.set('temperature', temp);
      } else if (choice === 'show') {
        console.log(chalk.gray('\nPersistent Config:'));
        console.log(JSON.stringify(config.store, null, 2));
      }
    }
  });

program
  .command('search')
  .description('Search across all indexed datasets globally')
  .argument('<query>', 'The search query')
  .action(async (query) => {
    const ora = (await import('ora')).default;
    const path = (await import('path')).default;
    const spinner = ora('Searching globally...').start();
    try {
      const embeddings = await getEmbeddings();
      const results = await globalSearch(query, embeddings, 5);
      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow('\n× No results found in any indexed dataset.'));
        return;
      }

      console.log(chalk.bold.cyan(`\n🔍 Global Search Results for: "${query}"\n`));
      results.forEach((r, i) => {
        console.log(chalk.white(`[${i + 1}] `) + chalk.bold(path.basename(r.metadata.source || 'Unknown')));
        console.log(chalk.gray(` Namespace: ${r.namespace}`));
        console.log(chalk.gray(` Snippet: ${r.pageContent.slice(0, 150).replace(/\n/g, ' ')}...`));
        console.log(chalk.gray('--------------------------------------------------'));
      });
    } catch (e) {
      spinner.fail('Search failed.');
      console.error(chalk.red(e.message));
    }
  });

program
  .command('maintenance')
  .description('Perform system hygiene and clean up stale caches')
  .action(async () => {
    const ora = (await import('ora')).default;
    const fs = (await import('fs-extra')).default;
    const path = (await import('path')).default;
    const spinner = ora('Performing system hygiene...').start();
    
    try {
      const cacheDir = path.join(process.cwd(), '.snapmind_cache');
      const sessionsDir = path.join(cacheDir, 'sessions');

      let cleanedNamespaces = 0;
      if (await fs.pathExists(sessionsDir)) {
        const namespaces = await fs.readdir(sessionsDir);
        for (const ns of namespaces) {
          const nsPath = path.join(sessionsDir, ns);
          if (await fs.pathExists(nsPath)) {
            const files = await fs.readdir(nsPath);
            if (files.length === 0) {
              await fs.remove(nsPath);
              cleanedNamespaces++;
            }
          }
        }
      }

      spinner.succeed(`Hygiene complete. Removed ${cleanedNamespaces} orphan namespaces.`);
    } catch (e) {
      spinner.fail('Maintenance failed.');
      console.error(chalk.red(e.message));
    }
  });

program
  .command('vault')
  .description('Manage secure API credentials in OS Keychain')
  .argument('[action]', 'Action (set, delete, list)', 'list')
  .argument('[provider]', 'The AI provider (openai, anthropic, etc.)')
  .action(async (action, provider) => {
    const { setKey, deleteKey } = await import('./utils/credentials.js');
    if (action === 'set' && provider) {
      const inquirer = (await import('inquirer')).default;
      const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: `Enter key for ${provider}:`, mask: '*' }]);
      await setKey(provider, key);
      console.log(chalk.green(`✅ Secured ${provider} key in OS Vault.`));
    } else if (action === 'delete' && provider) {
      await deleteKey(provider);
    } else {
      console.log(chalk.cyan('\n🔒 SnapMind Secure Vault'));
      console.log(chalk.gray('  Usage: snapmind vault set <provider>'));
      console.log(chalk.gray('  Usage: snapmind vault delete <provider>'));
    }
  });

program
  .action(async (options) => {
    if (program.args.length > 0 && program.args[0] === 'config') return;

    const isDirect = options.repo || options.mount || options.persona || options.watch;
    
    // Auto-Routing (Feature 25)
    if (!options.persona && program.args.length > 0) {
      const { detectPersona } = await import('./utils/llm.js');
      const detected = await detectPersona(program.args.join(' '), options);
      console.log(chalk.gray(`\n⚡ Auto-routing to ${chalk.bold(detected)} intelligence...`));
      options.persona = detected;
    }

      // Large ASCII Art
      const asciiArt = figlet.textSync('SnapMind AI', { font: 'Slant', horizontalLayout: 'full' });
      // Apply a bold gradient-like effect (Cyan -> Blue)
      const lines = asciiArt.split('\n');
      console.log('');
      lines.forEach((line, i) => {
        const color = i < lines.length / 2 ? chalk.bold.cyan : chalk.bold.blueBright;
        console.log(color(line));
      });

      const personaList = [
        `${chalk.cyan('§ Scholar')}  :: Index PDFs, cite pages, deep research.`,
        `${chalk.blueBright('» Coder')}    :: Scan repos, refactor logic, fix bugs.`,
        `${chalk.green('∑ Analyst')}  :: Query data, find trends, export CSVs.`,
        `${chalk.magenta('¶ Writer')}   :: Scrape web, synthesize drafts.`,
      ].join('\n');

      console.log(boxen(personaList, {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: { left: 2, top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        title: chalk.bold.white(' Intelligence Architectures '),
        titleAlignment: 'center',
        width: 75
      }));
      
      console.log(chalk.gray(`\n  > System: Use ${chalk.white('/export')} inside any session to persist logs.\n`));


    try {
      await startMenu(options);
    } catch (e) {
      if (e.name === 'ExitPromptError' || e.message.includes('force closed')) {
        console.log(chalk.gray('\n  × Session ended.'));
      } else {
        throw e;
      }
    }
  });

program.parse(process.argv);
