import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { PACKAGE_ROOT, CACHE_DIR } from './paths.js';

const PLUGIN_DIR = path.join(CACHE_DIR, 'plugins');
const CATALOG_PATH = path.join(PACKAGE_ROOT, 'src', 'data', 'plugin-catalog.json');

export function getPluginDir() {
  return PLUGIN_DIR;
}

export async function loadCatalog(registryUrl = null) {
  if (registryUrl) {
    const response = await fetch(registryUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch plugin registry (${response.status})`);
    }
    return response.json();
  }

  if (await fs.pathExists(CATALOG_PATH)) {
    return fs.readJson(CATALOG_PATH);
  }

  return { plugins: [] };
}

export async function listCatalogPlugins(registryUrl = null) {
  const catalog = await loadCatalog(registryUrl);
  return catalog.plugins || [];
}

export async function installCatalogPlugin(id, registryUrl = null) {
  const plugins = await listCatalogPlugins(registryUrl);
  const entry = plugins.find((p) => p.id === id);
  if (!entry) {
    throw new Error(`Plugin "${id}" not found in catalog.`);
  }

  await fs.ensureDir(PLUGIN_DIR);
  const targetFile = path.join(PLUGIN_DIR, `${entry.name || entry.id}.js`);

  if (entry.bundle) {
    const bundlePath = path.join(PACKAGE_ROOT, entry.bundle);
    if (!(await fs.pathExists(bundlePath))) {
      throw new Error(`Bundled plugin missing: ${entry.bundle}`);
    }
    await fs.copy(bundlePath, targetFile);
  } else if (entry.url) {
    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new Error(`Failed to download plugin (${response.status})`);
    }
    await fs.writeFile(targetFile, await response.text(), 'utf8');
  } else {
    throw new Error(`Plugin "${id}" has no bundle or url.`);
  }

  console.log(chalk.green(`✅ Installed plugin "${entry.name || entry.id}" to ${targetFile}`));
  return targetFile;
}

export async function searchCatalogPlugins(query, registryUrl = null) {
  const q = query.toLowerCase();
  const plugins = await listCatalogPlugins(registryUrl);
  return plugins.filter(
    (p) =>
      p.id.toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
  );
}
