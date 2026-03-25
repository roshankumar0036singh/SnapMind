import { startScholar } from '../personas/scholar.js';
import { startCoder } from '../personas/coder.js';
import { startAnalyst } from '../personas/analyst.js';

export async function startMenu(options) {
  let persona = options.persona;

  if (!persona) {
    if (options.mount || options.pages) persona = 'scholar';
    if (options.repo) persona = 'coder';
  }

  if (!persona) {
    const result = await inquirer.prompt([
      {
        type: 'list',
        name: 'persona',
        message: 'What best describes your workflow right now?',
        choices: [
          { name: chalk.yellow('🎓 The Scholar') + ' (Deep chat with PDFs & Citations)', value: 'scholar' },
          { name: chalk.blue('💻 The Coder') + ' (Chat with a codebase or GitHub repo)', value: 'coder' },
          { name: chalk.green('📊 The Analyst') + ' (Query massive CSV/Excel files)', value: 'analyst' },
          { name: chalk.magenta('✍️ The Writer') + ' (Synthesize web research)', value: 'writer' },
          { name: chalk.red('❌ Exit'), value: 'exit' },
        ],
      },
    ]);
    persona = result.persona;
  }

  if (persona === 'exit') {
    console.log(chalk.gray('Goodbye! Take care of your mind.'));
    process.exit(0);
  }

  if (persona === 'scholar') {
    await startScholar(options);
    return;
  }

  if (persona === 'coder') {
    await startCoder(options);
    return;
  }

  if (persona === 'analyst') {
    await startAnalyst(options);
    return;
  }



  // Other personas planned soon
  const spinner = ora(`Setting up ${persona} environment...`).start();
  setTimeout(() => {
    spinner.succeed(`${persona.charAt(0).toUpperCase() + persona.slice(1)} environment ready!`);
    console.log(chalk.cyan(`\n(Feature coming soon: Starting RAG session for ${persona}...)\n`));
  }, 1000);
}
