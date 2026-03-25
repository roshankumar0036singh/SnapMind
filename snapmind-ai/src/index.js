#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { startMenu } from './cli/menu.js';

const program = new Command();

program
  .name('snapmind-ai')
  .description('The ultimate local AI companion for students, developers, and analysts.')
  .version('1.0.0')
  .option('--airgap', 'Run in 100% offline mode using local models only')
  .option('--watch <path>', 'Automatically index changes in the specified directory')
  .action(async (options) => {
    console.log(chalk.cyan.bold('\n🧠 SnapMind AI - Your Local Knowledge Bridge\n'));
    await startMenu(options);
  });

program.parse(process.argv);
