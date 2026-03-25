import keytar from 'keytar';
import inquirer from 'inquirer';
import chalk from 'chalk';

const SERVICE_NAME = 'snapmind-ai';

export async function getKey(provider) {
  const accountName = `${provider}-api-key`;
  try {
    let key = await keytar.getPassword(SERVICE_NAME, accountName);
    
    if (!key) {
      console.log(chalk.yellow(`\n⚠️ ${provider} API Key not found in system keychain.`));
      const { newKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'newKey',
          message: `Please enter your ${provider} API Key:`,
          validate: (input) => input.length > 0 || 'Key cannot be empty',
        },
      ]);
      
      await keytar.setPassword(SERVICE_NAME, accountName, newKey);
      console.log(chalk.green('✅ Key securely stored in OS Keychain.\n'));
      key = newKey;
    }
    
    return key;
  } catch (error) {
    console.error(chalk.red('Error accessing system keychain:'), error.message);
    return null;
  }
}

export async function setKey(provider, value) {
  await keytar.setPassword(SERVICE_NAME, `${provider}-api-key`, value);
}

export async function deleteKey(provider) {
  await keytar.deletePassword(SERVICE_NAME, `${provider}-api-key`);
  console.log(chalk.gray(`${provider} API Key removed from keychain.`));
}

