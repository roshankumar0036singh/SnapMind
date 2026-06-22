import { startWriter } from '../personas/writer.js';
import { startCustomPersona } from '../personas/custom_runner.js';
import { listCustomPersonas } from '../utils/persona_store.js';
import { runPersonaWizard } from '../utils/persona_wizard.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export async function startMenu(options) {
  let currentOptions = { ...options };
  let persona = currentOptions.persona;

  while (true) {
    if (!persona) {
      if (currentOptions.mount || currentOptions.pages) persona = 'scholar';
      else if (currentOptions.repo || currentOptions.watch) persona = 'coder';
    }

    if (!persona) {
      const customPersonas = await listCustomPersonas();
      
      const choices = [
        { name: `${chalk.cyan('§')} ${chalk.bold('Scholar')}   (Deep Research & Citations)`, value: 'scholar' },
        { name: `${chalk.blueBright('»')} ${chalk.bold('Coder')}     (Codebase & Repo Intelligence)`, value: 'coder' },
        { name: `${chalk.green('∑')} ${chalk.bold('Analyst')}   (Structured Data & CSV Insight)`, value: 'analyst' },
        { name: `${chalk.magenta('¶')} ${chalk.bold('Writer')}    (Web Research & Synthesis)`, value: 'writer' },
      ];

      if (customPersonas.length > 0) {
        choices.push(new inquirer.Separator('--- Custom Architectures ---'));
        customPersonas.forEach(p => {
          const color = chalk.hex(p.color || '#ffffff');
          choices.push({ name: `${color(p.icon)} ${chalk.bold(p.displayName)}`, value: `custom:${p.name}` });
        });
      }

      choices.push(new inquirer.Separator());
      choices.push({ name: `${chalk.yellow('➕')} ${chalk.bold('Create New Persona')}`, value: 'create' });
      choices.push({ name: `${chalk.red('×')} ${chalk.bold('Exit')}`, value: 'exit' });

      try {
        const result = await inquirer.prompt([
          {
            type: 'list',
            name: 'persona',
            message: 'Select an Intelligence Architecture:',
            choices,
          },
        ]);
        persona = result.persona;
      } catch (e) {
        if (e.name === 'ExitPromptError') return;
        throw e;
      }
    }

    if (persona === 'exit') break;

    if (persona === 'create') {
       const newPersona = await runPersonaWizard();
       if (newPersona) {
         persona = `custom:${newPersona.name}`;
       } else {
         persona = null;
         continue;
       }
    }
    
    // Normalize persona for case-insensitive lookup and handle common prefixes like '/'
    const normalizedPersona = persona.toLowerCase().trim().replace(/^\//, '');

    const personaMap = {
      scholar: (await import('../personas/scholar.js')).startScholar,
      coder: (await import('../personas/coder.js')).startCoder,
      analyst: (await import('../personas/analyst.js')).startAnalyst,
      writer: (await import('../personas/writer.js')).startWriter,
    };

    if (normalizedPersona.startsWith('custom:')) {
      const customName = normalizedPersona.split(':')[1];
      const customConfig = await (await import('../utils/persona_store.js')).loadPersona(customName);
      if (customConfig) {
        const handoff = await (await import('../personas/custom_runner.js')).startCustomPersona(customConfig, currentOptions);
        if (handoff && handoff.collaborate) {
           currentOptions.history = handoff.history || currentOptions.history;
           const orch = await import('../personas/orchestrator.js');
           await orch.runCollaboration(handoff.collaborate, currentOptions);
           continue;
        }
        if (handoff && handoff.target) {
          persona = handoff.target;
          currentOptions = { ...currentOptions, history: handoff.history, mount: handoff.mount || currentOptions.mount };
          console.log(chalk.yellow(`\n🚀 Handing off to ${chalk.bold(persona.toUpperCase())}...`));
          continue;
        }
      }
    } else if (personaMap[normalizedPersona]) {
      const handoff = await personaMap[normalizedPersona](currentOptions);
      if (handoff && handoff.collaborate) {
         currentOptions.history = handoff.history || currentOptions.history;
         const orch = await import('../personas/orchestrator.js');
         await orch.runCollaboration(handoff.collaborate, currentOptions);
         continue;
      }
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
