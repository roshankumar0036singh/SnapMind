import { Command } from 'commander';
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
import inquirer from 'inquirer';
import { startMenu } from './cli/menu.js';
import config from './utils/config.js';
import { setKey } from './utils/credentials.js';


const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

const program = new Command();

program
  .name('snapmind-ai')
  .description('The ultimate local AI companion for students, developers, and analysts.')
  .version('1.0.0')
  .option('--airgap', 'Run in 100% offline mode using local models only')
  .option('--watch <path>', 'Automatically index changes in the specified directory')
  .option('--repo <url>', 'Clone and index a GitHub repository')
  .option('--mount <path>', 'Mount and index a local directory recursively')
  .option('--pages <range>', 'Specific page range to index (e.g., 1-10)');


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
        const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: `Enter API key for ${provider}:` }]);
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
  .action(async (options) => {
    if (program.args.length > 0 && program.args[0] === 'config') return;

    const isDirect = options.repo || options.mount || options.persona || options.watch;

    if (!isDirect) {
      const animation = chalkAnimation.glitch('S N A P M I N D   A I');
      await new Promise(resolve => setTimeout(resolve, 1500));
      animation.stop();

      console.log(chalk.bold.cyan('\n🚀 Your Universal Intelligence Companion'));
      console.log(chalk.gray('------------------------------------------'));
      console.log(`${chalk.yellow('🎓 Scholar')} : Index PDFs, cite pages, deep research.`);
      console.log(`${chalk.blue('💻 Coder')}   : Scan repos, refactor logic, fix bugs.`);
      console.log(`${chalk.green('📊 Analyst')} : Query data, find trends, export CSVs.`);
      console.log(`${chalk.magenta('✍️ Writer')}  : Scrape web, synthesize drafts, outlines.`);
      console.log(chalk.gray('------------------------------------------'));
      console.log(chalk.white('Tip: Use /export inside any chat to save your progress.\n'));
    }

    await startMenu(options);
  });

program.parse(process.argv);
