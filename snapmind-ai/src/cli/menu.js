import { startScholar } from '../personas/scholar.js';
import { startCoder } from '../personas/coder.js';
import { startAnalyst } from '../personas/analyst.js';
import { startWriter } from '../personas/writer.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export async function startMenu(options) {
  let persona = options.persona;

  if (!persona) {
    if (options.mount || options.pages) persona = 'scholar';
    if (options.repo || options.watch) persona = 'coder';
  }

  if (!persona) {
    const result = await inquirer.prompt([
      {
        type: 'list',
        name: 'persona',
        message: 'Select an Intelligence Architecture:',
        choices: [
          { name: `${chalk.cyan('§')} ${chalk.bold('Scholar')}   (Deep Research & Citations)`, value: 'scholar' },
          { name: `${chalk.blueBright('»')} ${chalk.bold('Coder')}     (Codebase & Repo Intelligence)`, value: 'coder' },
          { name: `${chalk.green('∑')} ${chalk.bold('Analyst')}   (Structured Data & CSV Insight)`, value: 'analyst' },
          { name: `${chalk.magenta('¶')} ${chalk.bold('Writer')}    (Web Research & Synthesis)`, value: 'writer' },
          { name: `${chalk.red('×')} ${chalk.bold('Exit')}`, value: 'exit' },
        ],
      },
    ]);
    persona = result.persona;
  }

  if (persona === 'exit') {
    return;
  }

  const personaMap = {
    scholar: startScholar,
    coder: startCoder,
    analyst: startAnalyst,
    writer: startWriter,
  };

  if (personaMap[persona]) {
    await personaMap[persona](options);
  } else {
    console.log(chalk.red(`\nUnknown persona: ${persona}`));
  }
}
