import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

const PERSONA_DIR = path.join(os.homedir(), '.snapmind', 'personas');

export const DEFAULT_PERSONA_CONFIG = {
  displayName: 'New Custom Persona',
  icon: '🤖',
  color: '#00d4ff',
  systemPrompt: 'You are a helpful assistant.',
  fileTypes: ['.pdf', '.txt', '.md'],
  chunkSize: 1000,
  chunkOverlap: 200,
  similarityK: 5,
  greeting: 'Ready to assist you.',
  commands: [],
  temperature: 0.3,
  basePersona: 'scholar'
};

/**
 * Ensures the persona directory exists.
 */
export async function ensurePersonaDir() {
  await fs.ensureDir(PERSONA_DIR);
}

/**
 * Saves a persona configuration to the custom directory.
 */
export async function savePersona(name, config) {
  await ensurePersonaDir();
  const personaPath = path.join(PERSONA_DIR, `${name}.json`);
  const finalConfig = { ...DEFAULT_PERSONA_CONFIG, ...config, name };
  await fs.writeJson(personaPath, finalConfig, { spaces: 2 });
  return finalConfig;
}

/**
 * Loads a single custom persona by name.
 */
export async function loadPersona(name) {
  const personaPath = path.join(PERSONA_DIR, `${name}.json`);
  if (!(await fs.pathExists(personaPath))) return null;
  const config = await fs.readJson(personaPath);
  return { ...DEFAULT_PERSONA_CONFIG, ...config };
}

/**
 * Lists all custom personas.
 */
export async function listCustomPersonas() {
  await ensurePersonaDir();
  const files = (await fs.readdir(PERSONA_DIR)).filter(f => f.endsWith('.json'));
  const personas = [];
  for (const file of files) {
    const name = file.replace('.json', '');
    const config = await loadPersona(name);
    if (config) personas.push(config);
  }
  return personas;
}

/**
 * Deletes a custom persona.
 */
export async function deletePersona(name) {
  const personaPath = path.join(PERSONA_DIR, `${name}.json`);
  if (await fs.pathExists(personaPath)) {
    await fs.remove(personaPath);
    return true;
  }
  return false;
}

/**
 * Exports a persona to the current directory.
 */
export async function exportPersona(name, targetDir = process.cwd()) {
  const config = await loadPersona(name);
  if (!config) throw new Error(`Persona ${name} not found.`);
  const exportPath = path.join(targetDir, `${name}.snapmind.json`);
  await fs.writeJson(exportPath, config, { spaces: 2 });
  return exportPath;
}

/**
 * Imports a persona from a file path.
 */
export async function importPersona(filePath) {
  if (!(await fs.pathExists(filePath))) throw new Error(`File ${filePath} not found.`);
  const config = await fs.readJson(filePath);
  if (!config.name) throw new Error('Invalid persona file: missing name.');
  return await savePersona(config.name, config);
}
