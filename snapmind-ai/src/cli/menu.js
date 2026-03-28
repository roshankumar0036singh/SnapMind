import { startScholar } from '../personas/scholar.js';
import { startCoder } from '../personas/coder.js';
import { startAnalyst } from '../personas/analyst.js';
import { startWriter } from '../personas/writer.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export async function startMenu(options) {
  let currentOptions = { ...options };
  let persona = currentOptions.persona;

  while (true) {
    if (!persona) {
      if (currentOptions.mount || currentOptions.pages) persona = 'scholar';
      if (currentOptions.repo || currentOptions.watch) persona = 'coder';
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

    if (persona === 'exit') break;
    
    // Normalize persona for case-insensitive lookup and handle common prefixes like '/'
    const normalizedPersona = persona.toLowerCase().trim().replace(/^\//, '');

    const personaMap = {
      scholar: startScholar,
      coder: startCoder,
      analyst: startAnalyst,
      writer: startWriter,
    };

    if (personaMap[normalizedPersona]) {
      const handoff = await personaMap[normalizedPersona](currentOptions);
      if (handoff && handoff.target) {
        persona = handoff.target;
        currentOptions = { ...currentOptions, history: handoff.history, mount: handoff.mount || currentOptions.mount };
        console.log(chalk.yellow(`\n🚀 Handing off to ${chalk.bold(persona.toUpperCase())}...`));
        continue;
      }
    } else {
      console.log(chalk.red(`\nUnknown persona: ${persona}`));
    }
    
    // If no handoff, return to menu or exit
    persona = null; 
    if (options.persona) break; // If launched with a specific persona, just once.
  }
}
