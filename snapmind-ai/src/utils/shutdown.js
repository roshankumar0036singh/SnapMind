import chalk from 'chalk';

const watchers = [];
const cleanupHandlers = [];

export function registerWatcher(watcher) {
  if (watcher) watchers.push(watcher);
}

export function onShutdown(handler) {
  cleanupHandlers.push(handler);
}

export async function gracefulShutdown(exitCode = 130) {
  for (const watcher of watchers) {
    try {
      await watcher.close();
    } catch {
      // Ignore watcher close errors during shutdown.
    }
  }

  for (const handler of cleanupHandlers) {
    try {
      await handler();
    } catch {
      // Ignore cleanup errors during shutdown.
    }
  }

  console.log(chalk.gray('\n\n  × Shutdown requested. Take care of your mind!'));
  process.exit(exitCode);
}
