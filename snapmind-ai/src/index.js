import { Command } from 'commander';
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
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
      console.log(chalk.cyan('\n🛠️ Current Configuration:'));
      console.log(JSON.stringify(config.store, null, 2));
    }
  });

program
  .action(async (options) => {
    if (program.args.length > 0 && program.args[0] === 'config') return;
    const title = chalkAnimation.glitch('🧠 SnapMind AI - Your Local Knowledge Bridge');
    await sleep(1500);
    title.stop();
    console.log('');
    await startMenu(options);
  });

program.parse(process.argv);


