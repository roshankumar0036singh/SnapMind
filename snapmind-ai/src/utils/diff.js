import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadSession } from './session.js';

/**
 * Compare two named snapshots side-by-side.
 * Shows messages that exist in one snapshot but not the other.
 */
export async function diffSnapshots(namespace, nameA, nameB) {
  const historyA = await loadSession(namespace, nameA);
  const historyB = await loadSession(namespace, nameB);

  if (historyA.length === 0 && historyB.length === 0) {
    console.log(chalk.yellow('\nBoth snapshots are empty or not found.'));
    return;
  }

  const maxLen = Math.max(historyA.length, historyB.length);
  console.log(chalk.bold.cyan(`\nSnapshot Diff: "${nameA}" vs "${nameB}"\n`));
  console.log(chalk.gray(`  "${nameA}": ${historyA.length} messages`));
  console.log(chalk.gray(`  "${nameB}": ${historyB.length} messages\n`));

  // Find divergence point
  let divergeAt = 0;
  for (let i = 0; i < Math.min(historyA.length, historyB.length); i++) {
    if (historyA[i].content !== historyB[i].content) {
      divergeAt = i;
      break;
    }
    divergeAt = i + 1;
  }

  if (divergeAt >= Math.min(historyA.length, historyB.length)) {
    console.log(chalk.green(`  Shared history: ${divergeAt} messages (identical)`));
    if (historyA.length > historyB.length) {
      console.log(chalk.yellow(`  "${nameA}" has ${historyA.length - divergeAt} additional messages.`));
    } else if (historyB.length > historyA.length) {
      console.log(chalk.yellow(`  "${nameB}" has ${historyB.length - divergeAt} additional messages.`));
    }
  } else {
    console.log(chalk.green(`  Shared history: ${divergeAt} messages`));
    console.log(chalk.red(`  Diverges at message ${divergeAt + 1}:\n`));

    const msgA = historyA[divergeAt];
    const msgB = historyB[divergeAt];
    console.log(chalk.red(`  - [${nameA}] ${msgA.role}: ${msgA.content.slice(0, 120)}...`));
    console.log(chalk.green(`  + [${nameB}] ${msgB.role}: ${msgB.content.slice(0, 120)}...`));
  }
  console.log('');
}
