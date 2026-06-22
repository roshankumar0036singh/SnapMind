#!/usr/bin/env node
import { readFileSync } from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import figlet from 'figlet';
import boxen from 'boxen';
import { startMenu } from './cli/menu.js';
import config from './utils/config.js';
import { setKey, deleteKey } from './utils/credentials.js';
import { globalSearch } from './utils/vector_storage.js';
import { getEmbeddings, buildCliOptions } from './utils/llm.js';
import { 
  savePersona, 
  listCustomPersonas, 
  deletePersona, 
  exportPersona, 
  importPersona 
} from './utils/persona_store.js';
import { CACHE_DIR, migrateLegacyCache, resolveTemplatePath } from './utils/paths.js';
import { gracefulShutdown } from './utils/shutdown.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

await migrateLegacyCache();

// Graceful exit on Ctrl+C
process.on('SIGINT', () => {
  gracefulShutdown(130);
});

const program = new Command();

program
  .name('snapmind-ai')
  .description('The ultimate local AI companion for students, developers, and analysts.')
  .version(pkg.version)
  .argument('[extraPaths...]', 'Extra paths if spaces were not escaped')
  .option('--airgap', 'Run in 100% offline mode using local models only')
  .option('--watch <path>', 'Automatically index changes in the specified directory')
  .option('--repo <url>', 'Clone and index a GitHub repository')
  .option('--mount <path>', 'Mount and index a local directory recursively')
  .option('--pages <range>', 'Specific page range to index (e.g., 1-10)')
  .option('--persona <name>', 'Select persona directly (scholar, coder, analyst, writer)')
  .option('--pipe', 'Read input from stdin (e.g., cat file.txt | snapmind-ai --pipe --persona scholar)')
  .option('--multilingual', 'Use multilingual embedding model (snowflake-arctic-embed / text-embedding-3-large)');


program
  .command('config')
  .description('Manage SnapMind AI configuration')
  .argument('[action]', 'Action to perform (set, get, list, reset)', 'list')
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
    } else if (action === 'reset') {
      const provider = key;
      if (provider) {
        await deleteKey(provider);
        console.log(chalk.green(`✅ ${provider} API Key has been reset.`));
      } else {
        const answers = await inquirer.prompt([{
          type: 'list',
          name: 'provider',
          message: 'Select AI model provider to reset key for:',
          choices: ['openai', 'mistral', 'anthropic', 'gemini']
        }]);
        await deleteKey(answers.provider);
        console.log(chalk.green(`✅ ${answers.provider} API Key has been reset.`));
      }
    } else if (action === 'list') {
      console.log(JSON.stringify(config.store, null, 2));
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
            { name: 'Reset Expired API Key', value: 'reset' },
            { name: 'Adjust Temperature', value: 'temperature' },
            { name: 'Intelligence Mode (Local / Remote)', value: 'mode' },
            { name: 'Backend URL (Remote Mode)', value: 'backend' },
            { name: 'Default Model Name', value: 'model' },
            { name: 'Toggle Hybrid Search', value: 'hybrid' },
            { name: 'Toggle Multilingual Embeddings', value: 'multilingual' },
            { name: 'Memory Window (messages)', value: 'memory' },
            { name: 'Citation Grounding (Scholar)', value: 'grounding' },
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
      } else if (choice === 'reset') {
        const { provider } = await inquirer.prompt([{
          type: 'list',
          name: 'provider',
          message: 'Select provider to reset the expired key for:',
          choices: ['openai', 'mistral', 'anthropic', 'gemini']
        }]);
        await deleteKey(provider);
        console.log(chalk.green(`✅ ${provider} API Key has been reset.`));
      } else if (choice === 'temperature') {
        const { temp } = await inquirer.prompt([{ type: 'number', name: 'temp', message: 'Enter temperature (0.0 - 1.0):', default: config.get('temperature') }]);
        config.set('temperature', temp);
      } else if (choice === 'mode') {
        const { mode } = await inquirer.prompt([{
          type: 'list',
          name: 'mode',
          message: 'Select intelligence mode:',
          choices: [
            { name: 'Local (LanceDB on this machine)', value: 'local' },
            { name: 'Remote (FastAPI SnapMind backend)', value: 'remote' },
          ],
          default: config.get('mode'),
        }]);
        config.set('mode', mode);
        console.log(chalk.green(`✅ Mode set to ${mode}`));
      } else if (choice === 'backend') {
        const { backendUrl } = await inquirer.prompt([{
          type: 'input',
          name: 'backendUrl',
          message: 'Backend URL:',
          default: config.get('backendUrl'),
          validate: (v) => /^https?:\/\//.test(v) || 'Enter a valid http(s) URL',
        }]);
        config.set('backendUrl', backendUrl.replace(/\/$/, ''));
        console.log(chalk.green(`✅ Backend URL updated`));
      } else if (choice === 'model') {
        const { model } = await inquirer.prompt([{
          type: 'input',
          name: 'model',
          message: 'Default model name (e.g. llama3, gpt-4o-mini):',
          default: config.get('model'),
        }]);
        config.set('model', model);
        console.log(chalk.green(`✅ Default model set to ${model}`));
      } else if (choice === 'hybrid') {
        const { hybridSearch } = await inquirer.prompt([{
          type: 'confirm',
          name: 'hybridSearch',
          message: 'Enable hybrid vector + keyword search?',
          default: config.get('hybridSearch'),
        }]);
        config.set('hybridSearch', hybridSearch);
        console.log(chalk.green(`✅ Hybrid search ${hybridSearch ? 'enabled' : 'disabled'}`));
      } else if (choice === 'multilingual') {
        const { multilingual } = await inquirer.prompt([{
          type: 'confirm',
          name: 'multilingual',
          message: 'Use multilingual embedding models?',
          default: config.get('multilingual'),
        }]);
        config.set('multilingual', multilingual);
        console.log(chalk.green(`✅ Multilingual embeddings ${multilingual ? 'enabled' : 'disabled'}`));
      } else if (choice === 'memory') {
        const { memoryWindow } = await inquirer.prompt([{
          type: 'number',
          name: 'memoryWindow',
          message: 'Max conversation messages to include in LLM context:',
          default: config.get('memoryWindow'),
        }]);
        config.set('memoryWindow', memoryWindow);
        console.log(chalk.green(`✅ Memory window set to ${memoryWindow} messages`));
      } else if (choice === 'grounding') {
        const { citationGrounding } = await inquirer.prompt([{
          type: 'confirm',
          name: 'citationGrounding',
          message: 'Require sufficient retrieved context before Scholar answers?',
          default: config.get('citationGrounding'),
        }]);
        config.set('citationGrounding', citationGrounding);
        console.log(chalk.green(`✅ Citation grounding ${citationGrounding ? 'enabled' : 'disabled'}`));
      } else if (choice === 'show') {
        console.log(chalk.gray('\nPersistent Config:'));
        console.log(JSON.stringify(config.store, null, 2));
      }
    }
  });

program
  .command('help')
  .description('Display detailed help and overview of SnapMind AI')
  .action(() => {
    console.log(chalk.cyan.bold('\n🧠 SnapMind AI - Overview'));
    console.log(chalk.white('An intelligent CLI tool that brings RAG capabilities and specialized AI personas directly to your terminal.'));
    console.log(chalk.gray('\nAvailable Commands:'));
    console.log(chalk.white('  snapmind-ai                 ') + chalk.gray('- Start interactive CLI with personas'));
    console.log(chalk.white('  snapmind-ai config          ') + chalk.gray('- Manage settings and API keys'));
    console.log(chalk.white('  snapmind-ai config reset    ') + chalk.gray('- Reset a saved API key (useful if expired)'));
    console.log(chalk.white('  snapmind-ai search <query>  ') + chalk.gray('- Search across all indexed datasets'));
    console.log(chalk.white('  snapmind-ai index           ') + chalk.gray('- List, inspect, or clear vector indexes'));
    console.log(chalk.white('  snapmind-ai ingest <path>   ') + chalk.gray('- Index files without a persona session'));
    console.log(chalk.white('  snapmind-ai plugin          ') + chalk.gray('- Browse and install plugins'));
    console.log(chalk.white('  snapmind-ai vault           ') + chalk.gray('- Manage secure credentials in OS Keychain'));
    console.log(chalk.white('  snapmind-ai schedule        ') + chalk.gray('- Manage scheduled intelligence reports'));
    console.log(chalk.white('  snapmind-ai maintenance     ') + chalk.gray('- Clean up system and stale caches\n'));
    console.log(chalk.cyan('Run ' + chalk.bold('snapmind-ai --help') + ' for additional standard command options.\n'));
  });

program
  .command('search')
  .description('Search across all indexed datasets globally')
  .argument('<query>', 'The search query')
  .option('--airgap', 'Run embeddings offline via Ollama')
  .option('--multilingual', 'Use multilingual embedding model')
  .action(async (query, cmdOptions) => {
    const ora = (await import('ora')).default;
    const path = (await import('path')).default;
    const spinner = ora('Searching globally...').start();
    const llmOptions = buildCliOptions(cmdOptions);
    try {
      const embeddings = await getEmbeddings(llmOptions);
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
  .command('index')
  .description('Manage local vector indexes')
  .argument('[action]', 'Action: list, stats, clear', 'list')
  .argument('[namespace]', 'Namespace to clear (required for clear)')
  .option('--all', 'Clear all namespaces (use with clear)')
  .action(async (action, namespace, opts) => {
    const { getIndexStats, clearNamespace, clearAllNamespaces } = await import('./utils/index_manager.js');

    if (action === 'stats' || action === 'list') {
      const stats = await getIndexStats();
      if (stats.length === 0) {
        console.log(chalk.yellow('\nNo indexed namespaces found. Mount a folder or PDF in a persona session first.\n'));
        return;
      }

      console.log(chalk.bold.cyan(`\n📚 Indexed Namespaces (${stats.length})\n`));
      stats.forEach((entry) => {
        console.log(chalk.white(`  ${entry.namespace}`));
        console.log(chalk.gray(`     Chunks: ${entry.rowCount}  |  Session snapshots: ${entry.sessionCount}`));
      });
      console.log('');
      return;
    }

    if (action === 'clear') {
      if (opts.all) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Delete ALL indexed namespaces and their sessions?',
          default: false,
        }]);
        if (!confirm) {
          console.log(chalk.gray('\nCancelled.\n'));
          return;
        }
        const count = await clearAllNamespaces();
        console.log(chalk.green(`\n✅ Cleared ${count} namespace(s).\n`));
        return;
      }

      if (!namespace) {
        console.log(chalk.yellow('\nUsage: snapmind-ai index clear <namespace>'));
        console.log(chalk.gray('       snapmind-ai index clear --all\n'));
        return;
      }

      const removed = await clearNamespace(namespace);
      if (removed) {
        console.log(chalk.green(`\n✅ Namespace "${namespace}" cleared.\n`));
      } else {
        console.log(chalk.red(`\nNamespace "${namespace}" not found.\n`));
      }
      return;
    }

    console.log(chalk.yellow(`\nUnknown index action: ${action}`));
    console.log(chalk.gray('Usage: snapmind-ai index list|stats|clear [namespace]\n'));
  });

program
  .command('ingest')
  .description('Index a file or directory without starting a persona session')
  .argument('<path>', 'File or directory to index')
  .option('-t, --type <type>', 'Ingest type: auto, pdf, code, data', 'auto')
  .option('-n, --namespace <namespace>', 'Override vector namespace')
  .option('--pages <range>', 'PDF page range (e.g. 1-10)')
  .option('--airgap', 'Use offline Ollama embeddings')
  .option('--multilingual', 'Use multilingual embedding model')
  .action(async (targetPath, opts) => {
    const ora = (await import('ora')).default;
    const spinner = ora(`Indexing ${targetPath}...`).start();
    try {
      const { ingestSource } = await import('./utils/ingest.js');
      const result = await ingestSource(targetPath, {
        ...buildCliOptions(opts),
        type: opts.type,
        namespace: opts.namespace,
        pages: opts.pages,
      });
      spinner.succeed(`Indexed ${result.chunks} chunks (${result.type})`);
      console.log(chalk.gray(`  Path      : ${result.path}`));
      console.log(chalk.gray(`  Namespace : ${result.namespace}\n`));
    } catch (e) {
      spinner.fail('Ingest failed.');
      console.error(chalk.red(e.message));
      process.exitCode = 1;
    }
  });

program
  .command('plugin')
  .description('Browse and install SnapMind plugins')
  .addCommand(
    new Command('list')
      .description('List plugins from the catalog')
      .action(async () => {
        const configMod = (await import('./utils/config.js')).default;
        const { listCatalogPlugins } = await import('./utils/plugin_registry.js');
        const registryUrl = configMod.get('pluginRegistryUrl') || null;
        const plugins = await listCatalogPlugins(registryUrl || null);
        if (plugins.length === 0) {
          console.log(chalk.yellow('\nNo plugins found in catalog.\n'));
          return;
        }
        console.log(chalk.bold.cyan(`\nPlugin Catalog (${plugins.length})\n`));
        plugins.forEach((p) => {
          console.log(chalk.white(`  ${p.id}`) + chalk.gray(` — ${p.description}`));
        });
        console.log('');
      })
  )
  .addCommand(
    new Command('search')
      .description('Search the plugin catalog')
      .argument('<query>', 'Search term')
      .action(async (query) => {
        const configMod = (await import('./utils/config.js')).default;
        const { searchCatalogPlugins } = await import('./utils/plugin_registry.js');
        const registryUrl = configMod.get('pluginRegistryUrl') || null;
        const plugins = await searchCatalogPlugins(query, registryUrl || null);
        if (plugins.length === 0) {
          console.log(chalk.yellow(`\nNo plugins matched "${query}".\n`));
          return;
        }
        plugins.forEach((p) => {
          console.log(chalk.white(`  ${p.id}`) + chalk.gray(` — ${p.description}`));
        });
        console.log('');
      })
  )
  .addCommand(
    new Command('install')
      .description('Install a plugin by catalog id')
      .argument('<id>', 'Plugin id from catalog')
      .action(async (id) => {
        const configMod = (await import('./utils/config.js')).default;
        const { installCatalogPlugin } = await import('./utils/plugin_registry.js');
        try {
          const registryUrl = configMod.get('pluginRegistryUrl') || null;
          await installCatalogPlugin(id, registryUrl || null);
        } catch (e) {
          console.error(chalk.red(`\n${e.message}\n`));
          process.exitCode = 1;
        }
      })
  );

program
  .command('maintenance')
  .description('Perform system hygiene and clean up stale caches')
  .action(async () => {
    const ora = (await import('ora')).default;
    const fs = (await import('fs-extra')).default;
    const path = (await import('path')).default;
    const spinner = ora('Performing system hygiene...').start();
    
    try {
      const cacheDir = CACHE_DIR;
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
      console.log(chalk.gray('  Usage: snapmind-ai vault set <provider>'));
      console.log(chalk.gray('  Usage: snapmind-ai vault delete <provider>'));
    }
  });

program
  .command('schedule')
  .description('Manage scheduled intelligence reports (Feature 17)')
  .addCommand(
    new Command('add')
      .description('Schedule a recurring RAG report')
      .requiredOption('-q, --query <query>', 'The RAG query to run')
      .requiredOption('-c, --cron <expression>', 'Cron expression (e.g. "0 9 * * 1" = every Monday 9am)')
      .option('-p, --persona <persona>', 'Persona to use', 'scholar')
      .option('-n, --namespace <namespace>', 'Knowledge namespace to query')
      .option('-m, --mount <path>', 'Derive namespace from an indexed source path')
      .option('--airgap', 'Run embeddings offline via Ollama')
      .option('--multilingual', 'Use multilingual embedding model')
      .action(async (opts) => {
        const { addSchedule } = await import('./utils/scheduler.js');
        try {
          const id = await addSchedule(opts);
          console.log(chalk.green(`\nSchedule added with ID: ${chalk.bold(id)}`));
          console.log(chalk.gray(`  Query     : "${opts.query}"`));
          console.log(chalk.gray(`  Cron      : ${opts.cron}`));
          console.log(chalk.gray(`  Persona   : ${opts.persona}`));
          console.log(chalk.gray(`  Namespace : ${opts.namespace || (opts.mount ? '(from mount)' : 'n/a')}`));
          console.log(chalk.gray(`\nReports will be saved to: ~/snapmind_reports/`));
          console.log(chalk.gray(`Start with: snapmind-ai schedule run`));
        } catch (e) {
          console.error(chalk.red(`\n${e.message}`));
          process.exitCode = 1;
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all scheduled reports')
      .action(async () => {
        const { loadSchedules } = await import('./utils/scheduler.js');
        const schedules = await loadSchedules();
        if (schedules.length === 0) {
          console.log(chalk.yellow('\nNo schedules defined. Use: snapmind-ai schedule add'));
          return;
        }
        console.log(chalk.bold.cyan(`\nScheduled Intelligence Reports (${schedules.length})\n`));
        schedules.forEach(s => {
          console.log(chalk.white(`  [${s.id}] ${s.query}`));
          console.log(chalk.gray(`         Cron: ${s.cron}  |  Persona: ${s.persona}  |  NS: ${s.namespace}`));
        });
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove a schedule by ID')
      .argument('<id>', 'Schedule ID to remove')
      .action(async (id) => {
        const { removeSchedule } = await import('./utils/scheduler.js');
        const removed = await removeSchedule(id);
        if (removed) {
          console.log(chalk.green(`\nSchedule ${id} removed.`));
        } else {
          console.log(chalk.red(`\nSchedule ${id} not found.`));
        }
      })
  )
  .addCommand(
    new Command('run')
      .description('Start the cron scheduler (runs until Ctrl+C)')
      .option('--airgap', 'Run embeddings offline via Ollama')
      .option('--multilingual', 'Use multilingual embedding model')
      .action(async (opts) => {
        const { startScheduler } = await import('./utils/scheduler.js');
        await startScheduler(buildCliOptions(opts));
      })
  );

program
  .command('persona')
  .description('Manage custom AI personas')
  .addCommand(
    new Command('create')
      .description('Create a new custom persona')
      .option('--from <template>', 'Base the new persona on a template')
      .action(async (opts) => {
        const path = (await import('path')).default;
        const fs = (await import('fs-extra')).default;
        
        let initialConfig = {};
        if (opts.from) {
          const templatePath = resolveTemplatePath(opts.from);
          if (await fs.pathExists(templatePath)) {
            initialConfig = await fs.readJson(templatePath);
            delete initialConfig.name; // User will provide new name
          } else {
            console.log(chalk.yellow(`\nTemplate "${opts.from}" not found. Starting from scratch.`));
          }
        }

        const answers = await inquirer.prompt([
          { type: 'input', name: 'name', message: 'Unique ID for the persona (e.g. my-expert):', validate: (i) => /^[a-z0-9-]+$/.test(i) || 'Invalid ID' },
          { type: 'input', name: 'displayName', message: 'Display Name:', default: initialConfig.displayName || 'My Expert' },
          { type: 'input', name: 'icon', message: 'Emoji Icon:', default: initialConfig.icon || '🤖' },
          { type: 'input', name: 'color', message: 'Hex Color:', default: initialConfig.color || '#00d4ff' },
          { type: 'editor', name: 'systemPrompt', message: 'Core System Prompt:', default: initialConfig.systemPrompt || 'You are an expert assistant.' },
          { type: 'input', name: 'greeting', message: 'Initial Greeting:', default: initialConfig.greeting || 'Ready to assist.' }
        ]);

        await savePersona(answers.name, answers);
        console.log(chalk.green(`\n✅ Persona "${answers.name}" created successfully!`));
      })
  )
  .addCommand(
    new Command('list')
      .description('List all custom personas')
      .action(async () => {
        const personas = await listCustomPersonas();
        if (personas.length === 0) {
          console.log(chalk.yellow('\nNo custom personas found. create one with: snapmind-ai persona create'));
          return;
        }
        console.log(chalk.bold.cyan(`\nCustom Personas (${personas.length})\n`));
        personas.forEach(p => {
          console.log(chalk.white(`  ${p.icon} ${chalk.bold(p.displayName)} (${p.name})`));
          console.log(chalk.gray(`     Prompt: ${p.systemPrompt.slice(0, 60)}...`));
        });
      })
  )
  .addCommand(
    new Command('delete')
      .description('Delete a custom persona')
      .argument('<name>', 'ID of the persona to delete')
      .action(async (name) => {
        const success = await deletePersona(name);
        if (success) console.log(chalk.green(`\n✅ Persona "${name}" deleted.`));
        else console.log(chalk.red(`\nPersona "${name}" not found.`));
      })
  )
  .addCommand(
    new Command('export')
      .description('Export a persona to JSON')
      .argument('<name>', 'ID of the persona to export')
      .action(async (name) => {
        try {
          const path = await exportPersona(name);
          console.log(chalk.green(`\n✅ Exported to: ${path}`));
        } catch (e) {
          console.error(chalk.red(`\n${e.message}`));
        }
      })
  )
  .addCommand(
    new Command('import')
      .description('Import a persona from JSON file')
      .argument('<path>', 'Path to the JSON file')
      .action(async (p) => {
        try {
          const persona = await importPersona(p);
          console.log(chalk.green(`\n✅ Imported persona: ${persona.displayName}`));
        } catch (e) {
          console.error(chalk.red(`\n${e.message}`));
        }
      })
  );

program
  .action(async (extraPaths, options) => {
    if (program.args.length > 0 && (['config', 'search', 'index', 'ingest', 'plugin', 'maintenance', 'vault', 'schedule', 'persona', 'help'].includes(program.args[0]))) return;

    // Fix for unquoted paths with spaces (Feature 30)
    if (extraPaths && extraPaths.length > 0 && options.mount) {
      options.mount = [options.mount, ...extraPaths].join(' ');
    }

    const isDirect = options.repo || options.mount || options.persona || options.watch;
    
    // Pipe Mode (Feature 29): read from stdin
    if (options.pipe) {
      const fs = (await import('fs-extra')).default;
      const path = (await import('path')).default;
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString('utf8');
      if (content.trim().length > 0) {
        const tmpDir = path.join(CACHE_DIR, 'pipe_input');
        await fs.ensureDir(tmpDir);
        const tmpFile = path.join(tmpDir, `stdin_${Date.now()}.txt`);
        await fs.writeFile(tmpFile, content);
        options.mount = tmpDir;
        console.log(chalk.gray(`\nPipe: Received ${content.length} chars from stdin.`));
      }
    }
    
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
      await startMenu(buildCliOptions(options));
    } catch (e) {
      if (e.name === 'ExitPromptError' || e.message.includes('force closed')) {
        console.log(chalk.gray('\n  × Session ended.'));
      } else {
        throw e;
      }
    }
  });

program.parse(process.argv);
