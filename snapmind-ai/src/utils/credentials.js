import keytar from 'keytar';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { SnapMindError } from './errors.js';

const SERVICE_NAME = 'snapmind-ai';
const cache = {};
const pending = {};

export async function getOptionalKey(provider) {
  const accountName = `${provider}-api-key`;
  if (cache[accountName]) return cache[accountName];

  try {
    const key = await keytar.getPassword(SERVICE_NAME, accountName);
    if (key) cache[accountName] = key;
    return key || null;
  } catch {
    return null;
  }
}

export async function getKey(provider) {
  const accountName = `${provider}-api-key`;
  if (cache[accountName]) return cache[accountName];
  if (pending[accountName]) return pending[accountName];

  pending[accountName] = (async () => {
    try {
      let key = await keytar.getPassword(SERVICE_NAME, accountName);

      if (!key) {
        if (!process.stdin.isTTY) {
          throw new SnapMindError(
            `${provider} API key not found and cannot prompt in non-interactive mode. Run: snapmind-ai vault set ${provider}`,
            'AUTH_MISSING'
          );
        }

        console.log(chalk.yellow(`\n⚠️ ${provider} API Key not found in system keychain.`));
        const { newKey } = await inquirer.prompt([
          {
            type: 'password',
            name: 'newKey',
            message: `Please enter your ${provider} API Key:`,
            mask: '*',
            validate: (input) => input.length > 0 || 'Key cannot be empty',
          },
        ]);

        await keytar.setPassword(SERVICE_NAME, accountName, newKey);
        console.log(chalk.green('✅ Key securely stored in OS Keychain.\n'));
        key = newKey;
      }

      cache[accountName] = key;
      delete pending[accountName];
      return key;
    } catch (error) {
      delete pending[accountName];
      if (error instanceof SnapMindError) throw error;
      console.error(chalk.red('Error accessing system keychain:'), error.message);
      return null;
    }
  })();

  return pending[accountName];
}

export async function requireApiKey(provider) {
  const key = await getKey(provider);
  if (!key) {
    throw new SnapMindError(
      `Missing API key for ${provider}. Run: snapmind-ai vault set ${provider}`,
      'AUTH_MISSING'
    );
  }
  return key;
}

export async function setKey(provider, value) {
  const accountName = `${provider}-api-key`;
  cache[accountName] = value;
  await keytar.setPassword(SERVICE_NAME, accountName, value);
}

export async function deleteKey(provider) {
  const accountName = `${provider}-api-key`;
  delete cache[accountName];
  await keytar.deletePassword(SERVICE_NAME, accountName);
  console.log(chalk.gray(`${provider} API Key removed from keychain.`));
}
