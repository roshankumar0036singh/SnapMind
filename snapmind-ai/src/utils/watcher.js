import chokidar from 'chokidar';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';

export function setupWatcher(targetPath, onUpdate) {
  const watcher = chokidar.watch(targetPath, {
    ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/dist/**', '**.snapmind_cache**'],
    persistent: true,
    ignoreInitial: true
  });

  const spinner = ora(chalk.gray('Watcher active: Monitoring for changes...')).start();

  watcher
    .on('add', filePath => {
       spinner.text = chalk.blue(`File added: ${path.basename(filePath)}. Syncing...`);
       onUpdate('add', filePath);
       spinner.text = chalk.gray('Watcher active: Monitoring for changes...');
    })
    .on('change', filePath => {
       spinner.text = chalk.yellow(`File changed: ${path.basename(filePath)}. Syncing...`);
       onUpdate('change', filePath);
       spinner.text = chalk.gray('Watcher active: Monitoring for changes...');
    })
    .on('unlink', filePath => {
       spinner.text = chalk.red(`File removed: ${path.basename(filePath)}. Syncing...`);
       onUpdate('unlink', filePath);
       spinner.text = chalk.gray('Watcher active: Monitoring for changes...');
    });

  return watcher;
}
