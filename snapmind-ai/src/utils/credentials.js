import keytar from 'keytar';
import inquirer from 'inquirer';
import chalk from 'chalk';

const SERVICE_NAME = 'snapmind-ai';
const ACCOUNT_NAME = 'mistral-api-key';

export async function getMistralKey() {
  try {
    let key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    
    if (!key) {
      console.log(chalk.yellow('\n⚠️ Mistral API Key not found in system keychain.'));
      const { newKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'newKey',
          message: 'Please enter your Mistral API Key:',
          validate: (input) => input.length > 0 || 'Key cannot be empty',
        },
      ]);
      
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, newKey);
      console.log(chalk.green('✅ Key securely stored in OS Keychain.\n'));
      key = newKey;
    }
    
    return key;
  } catch (error) {
    console.error(chalk.red('Error accessing system keychain:'), error.message);
    return null;
  }
}

export async function deleteMistralKey() {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  console.log(chalk.gray('Mistral API Key removed from keychain.'));
}
