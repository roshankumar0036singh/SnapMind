import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import { savePersona } from './persona_store.js';
import { resolveTemplatePath } from './paths.js';

export async function runPersonaWizard(templateName = null) {
  let initialConfig = {};
  if (templateName) {
    const templatePath = resolveTemplatePath(templateName);
    if (await fs.pathExists(templatePath)) {
      initialConfig = await fs.readJson(templatePath);
      delete initialConfig.name;
    }
  }

  console.log(chalk.cyan.bold('\n✨ SnapMind Persona Architect'));
  console.log(chalk.gray('Create a specialized AI agent with custom knowledge and behavior.\n'));

  const answers = await inquirer.prompt([
    { 
      type: 'input', 
      name: 'name', 
      message: 'Unique ID for the persona (e.g. bio-expert):', 
      validate: (i) => /^[a-z0-9-]+$/.test(i) || 'Invalid ID (use lowercase, numbers, and hyphens only)' 
    },
    { type: 'input', name: 'displayName', message: 'Display Name (e.g. 🥦 Bio Analyst):', default: initialConfig.displayName || 'My Expert' },
    { type: 'input', name: 'icon', message: 'Emoji Icon:', default: initialConfig.icon || '🤖' },
    { type: 'input', name: 'color', message: 'Terminal Hex Color:', default: initialConfig.color || '#00d4ff' },
    { type: 'editor', name: 'systemPrompt', message: 'Core System Prompt (Expertise, Style, Rules):', default: initialConfig.systemPrompt || 'You are an expert assistant.' },
    { type: 'input', name: 'greeting', message: 'Initial Greeting:', default: initialConfig.greeting || 'Ready to assist.' },
    { 
      type: 'checkbox', 
      name: 'fileTypes', 
      message: 'Supported File Types:', 
      choices: ['.pdf', '.txt', '.md', '.csv', '.js', '.ts', '.py', '.json'],
      default: initialConfig.fileTypes || ['.pdf', '.txt', '.md']
    },
    { type: 'input', name: 'basePersona', message: 'Base Architecture (scholar, coder, analyst, writer):', default: initialConfig.basePersona || 'scholar' }
  ]);

  const persona = await savePersona(answers.name, answers);
  console.log(chalk.green(`\n✅ Persona "${persona.displayName}" successfully archived in your neural library!`));
  return persona;
}
