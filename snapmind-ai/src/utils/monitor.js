import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { CACHE_DIR } from './constants.js';

const STATS_FILE = path.join(CACHE_DIR, 'usage_stats.json');

const PRICES = {
  'gpt-4o': { input: 0.005, output: 0.015 }, // per 1k tokens
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 }
};

/**
 * Records token usage for a specific model.
 */
export async function recordUsage(model, inputTokens, outputTokens) {
  const stats = await loadStats();
  const price = PRICES[model] || { input: 0, output: 0 };

  const cost = ((inputTokens / 1000) * price.input) + ((outputTokens / 1000) * price.output);

  stats.totalInputTokens += inputTokens;
  stats.totalOutputTokens += outputTokens;
  stats.totalCost += cost;

  if (!stats.models[model]) stats.models[model] = { input: 0, output: 0, cost: 0 };
  stats.models[model].input += inputTokens;
  stats.models[model].output += outputTokens;
  stats.models[model].cost += cost;

  await fs.writeJson(STATS_FILE, stats, { spaces: 2 });
}

export async function loadStats() {
  if (!(await fs.pathExists(STATS_FILE))) {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, models: {} };
  }
  return await fs.readJson(STATS_FILE);
}

export async function showStats() {
  const stats = await loadStats();
  console.log(chalk.bold.blue('\n📊 Persona Health Monitor'));
  console.log(chalk.gray('--------------------------'));
  console.log(`Input Tokens:  ${chalk.cyan(stats.totalInputTokens.toLocaleString())}`);
  console.log(`Output Tokens: ${chalk.cyan(stats.totalOutputTokens.toLocaleString())}`);
  console.log(`Total Cost:    ${chalk.green('$' + stats.totalCost.toFixed(4))}`);
  console.log(chalk.gray('--------------------------\n'));
}
