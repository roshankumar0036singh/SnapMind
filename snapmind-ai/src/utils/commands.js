import chalk from 'chalk';
import ora from 'ora';
import { streamToTerminal } from './streamer.js';
import { exportSession } from './exporter.js';

/**
 * Handles shared slash commands and Returns true if command was handled.
 * Returns an object { handled: boolean, focusLens?: string }
 */
export async function handleCommonCommands(query, { history, namespace, llm, currentFocus }) {
  const normQuery = query.toLowerCase().trim();

  if (normQuery === '/clear') {
    console.clear();
    return { handled: true, focusLens: currentFocus };
  }

  if (normQuery === '/help') {
    console.log(chalk.bold.cyan('\n⚙️  SnapMind Core Commands'));
    console.log(chalk.gray('--------------------------------------------------'));
    console.log(chalk.white('  /help      ') + chalk.gray('- Show this command list'));
    console.log(chalk.white('  /clear     ') + chalk.gray('- Clear the terminal screen'));
    console.log(chalk.white('  /history   ') + chalk.gray('- Display current conversation history'));
    console.log(chalk.white('  /summarize ') + chalk.gray('- Generate a summary of the session so far'));
    console.log(chalk.white('  /focus ... ') + chalk.gray('- Set a focus lens for subsequent queries'));
    console.log(chalk.white('  /unfocus   ') + chalk.gray('- Remove the current focus lens'));
    console.log(chalk.white('  /export    ') + chalk.gray('- Export the session as a markdown file'));
    console.log(chalk.white('  /stats     ') + chalk.gray('- Show token usage and cost statistics'));
    console.log(chalk.white('  /snapshot  ') + chalk.gray('- Save the current session with an optional name'));
    console.log(chalk.white('  /handoff   ') + chalk.gray('- Switch to a different persona'));
    console.log(chalk.white('  /collaborate... ') + chalk.gray('- Initiate multi-agent collaboration task'));
    console.log(chalk.white('  /global... ') + chalk.gray('- Search across all datasets globally'));
    console.log(chalk.white('  /grounding ') + chalk.gray('- Toggle strict citation grounding (Scholar)'));
    console.log(chalk.white('  /sync      ') + chalk.gray('- Incremental git re-index (Coder)'));
    console.log(chalk.white('  exit       ') + chalk.gray('- Exit the current session\n'));
    return { handled: true, focusLens: currentFocus };
  }

  if (normQuery === '/history') {
    console.log(chalk.bold.blue('\n📜 Session History'));
    console.log(chalk.gray('--------------------------------------------------'));
    if (!history || history.length === 0) {
      console.log(chalk.gray('No history in this session yet.\n'));
    } else {
      history.forEach((msg, i) => {
        const roleStr = msg.role === 'user' ? chalk.green('👤 You:') : chalk.magenta('🤖 Assistant:');
        console.log(`${roleStr} ${msg.content.slice(0, 200).replace(/\n/g, ' ')}${msg.content.length > 200 ? '...' : ''}\n`);
      });
    }
    return { handled: true, focusLens: currentFocus };
  }

  if (normQuery === '/summarize') {
    if (!history || history.length === 0) {
      console.log(chalk.yellow('\nNo history to summarize.\n'));
      return { handled: true, focusLens: currentFocus };
    }
    const spinner = ora('Summarizing session...').start();
    try {
      const historyText = history.map(h => `${h.role}: ${h.content}`).join('\n');
      const response = await llm.invoke([
        ['system', 'Summarize the following conversation history concisely.'],
        ['user', historyText]
      ]);
      spinner.stop();
      console.log(chalk.bold.cyan('\n📑 Session Summary:'));
      console.log(chalk.white(response.content) + '\n');
    } catch (e) {
      spinner.fail('Summary failed.');
      console.error(chalk.red(e.message));
    }
    return { handled: true, focusLens: currentFocus };
  }

  if (normQuery.startsWith('/focus ')) {
    const topic = query.replace('/focus', '').trim();
    console.log(chalk.green(`\n🎯 Focus lens set to: "${topic}"\n`));
    return { handled: true, focusLens: topic };
  }

  if (normQuery === '/unfocus') {
    console.log(chalk.yellow(`\n🎯 Focus lens removed.\n`));
    return { handled: true, focusLens: null };
  }

  if (normQuery === '/export') {
    await exportSession(history);
    return { handled: true, focusLens: currentFocus };
  }

  if (normQuery.startsWith('/collaborate ')) {
    const topic = query.replace('/collaborate', '').trim();
    return { handled: true, collaborate: topic, focusLens: currentFocus };
  }

  return { handled: false, focusLens: currentFocus };
}
