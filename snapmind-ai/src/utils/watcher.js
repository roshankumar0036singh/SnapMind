import chokidar from 'chokidar';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { registerWatcher } from './shutdown.js';

const DEBOUNCE_MS = 400;

export function setupWatcher(targetPath, onUpdate) {
  const pending = new Map();

  const watcher = chokidar.watch(targetPath, {
    ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/dist/**', '**/.snapmind/**', '**/.snapmind_cache/**'],
    persistent: true,
    ignoreInitial: true,
  });

  registerWatcher(watcher);

  const spinner = ora(chalk.gray('Watcher active: Monitoring for changes...')).start();

  const scheduleUpdate = (event, filePath) => {
    const key = filePath;
    if (pending.has(key)) clearTimeout(pending.get(key));

    pending.set(
      key,
      setTimeout(async () => {
        pending.delete(key);
        try {
          await onUpdate(event, filePath);
        } catch {
          // Ignore transient file read errors during sync.
        }
        spinner.text = chalk.gray('Watcher active: Monitoring for changes...');
      }, DEBOUNCE_MS)
    );
  };

  watcher
    .on('add', (filePath) => {
      spinner.text = chalk.blue(`File added: ${path.basename(filePath)}. Syncing...`);
      scheduleUpdate('add', filePath);
    })
    .on('change', (filePath) => {
      spinner.text = chalk.yellow(`File changed: ${path.basename(filePath)}. Syncing...`);
      scheduleUpdate('change', filePath);
    })
    .on('unlink', (filePath) => {
      spinner.text = chalk.red(`File removed: ${path.basename(filePath)}. Syncing...`);
      scheduleUpdate('unlink', filePath);
    });

  return watcher;
}
