import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { CACHE_DIR } from './paths.js';

const PLUGIN_DIR = path.join(CACHE_DIR, 'plugins');

/**
 * Loads all .js plugins from ~/.snapmind/plugins/
 * Each plugin exports: { name, description, execute(context) }
 * context = { query, history, vectorStore, llm, streamToTerminal }
 */
export async function loadPlugins() {
  await fs.ensureDir(PLUGIN_DIR);
  const files = (await fs.readdir(PLUGIN_DIR)).filter(f => f.endsWith('.js'));
  const plugins = [];

  for (const file of files) {
    try {
      const pluginPath = path.join(PLUGIN_DIR, file);
      const mod = await import(`file://${pluginPath}`);
      if (mod.default && mod.default.name && mod.default.execute) {
        plugins.push(mod.default);
      }
    } catch (e) {
      console.log(chalk.yellow(`  Plugin load error: ${file} — ${e.message}`));
    }
  }

  return plugins;
}

/**
 * Attempts to run a plugin by matching the command name.
 * Returns true if a plugin handled the command, false otherwise.
 */
export async function runPlugin(command, context, plugins) {
  const cmdName = command.split(' ')[0].replace('/', '');
  const plugin = plugins.find(p => p.name === cmdName);

  if (!plugin) return false;

  const args = command.replace(`/${cmdName}`, '').trim();
  try {
    await plugin.execute({ ...context, args });
  } catch (e) {
    console.log(chalk.red(`  Plugin error (${plugin.name}): ${e.message}`));
  }
  return true;
}
