import chalk from 'chalk';

export class SnapMindError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SnapMindError';
    this.code = code;
  }
}

export function handleError(error) {
  if (error instanceof SnapMindError) {
    console.log(chalk.red.bold(`\n❌ [${error.code}] ${error.message}`));
  } else if (error.message?.includes('fetch failed')) {
    console.log(chalk.red.bold('\n❌ Connection Error: ') + 'Could not reach the AI service. Check your internet connection or local Ollama daemon.');
  } else if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('API key')) {
    console.log(chalk.red.bold('\n❌ Authentication Error: ') + 'Invalid or expired API Key. Use `snapmind-ai config reset` to update it.');
  } else {
    console.log(chalk.red.bold('\n❌ Unexpected Error: ') + error.message);
    if (process.env.DEBUG) console.error(error);
  }
}
