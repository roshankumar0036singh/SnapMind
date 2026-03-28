import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatMistralAI, MistralAIEmbeddings } from '@langchain/mistralai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { getKey } from './credentials.js';
import config from './config.js';
import chalk from 'chalk';
import { SnapMindError } from './errors.js';
import { routeModel } from './router.js';
import { recordUsage } from './monitor.js';

let overrideProvider = null;

async function checkOllama(airgap) {
  try {
    const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
    if (!(response && response.status === 200)) {
      if (airgap) throw new SnapMindError('Ollama not running! Airgap mode requires local Ollama.', 'LOCAL_OFFLINE');
      
      const inquirer = (await import('inquirer')).default;
      console.log(chalk.yellow('\n⚠️ Local Ollama runs offline but is NOT detected on port 11434.'));
      console.log(chalk.gray('  You can install it for free from https://ollama.com\n'));
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'How would you like to proceed?',
          choices: [
            { name: 'Use OpenAI (Requires API Key)', value: 'openai' },
            { name: 'Use Google Gemini (Requires API Key)', value: 'gemini' },
            { name: 'Use Anthropic / Claude (Requires API Key)', value: 'anthropic' },
            { name: 'Use Mistral AI (Requires API Key)', value: 'mistral' },
            { name: 'Let me start Ollama natively. Retry connection.', value: 'retry' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      const validChoices = ['openai', 'gemini', 'anthropic', 'mistral', 'retry', 'exit'];
      const normalizedAction = (action || '').toString().toLowerCase();

      if (!validChoices.includes(normalizedAction)) {
        console.log(chalk.red(`\n❌ Invalid choice: "${action}". You must type the exact name of the provider (e.g. "openai" or "mistral") if your terminal arrow keys are broken.`));
        return checkOllama(airgap);
      }

      if (normalizedAction === 'exit') {
        process.exit(1);
      } else if (normalizedAction === 'retry') {
        return checkOllama(airgap);
      } else {
        overrideProvider = normalizedAction;
        console.log(chalk.cyan(`\nSwitching to ${normalizedAction.toUpperCase()}...`));
        return true;
      }
    }
    return false;
  } catch (e) {
    if (airgap) throw e;
    return false;
  }
}

export async function getEmbeddings(options = {}) {
  let provider = overrideProvider || options.provider || config.get('provider');
  const airgap = options.airgap || false;
  const multilingual = options.multilingual || config.get('multilingual') || false;

  if (!overrideProvider && (airgap || provider === 'ollama')) {
    const overrode = await checkOllama(airgap);
    if (overrode) provider = overrideProvider;
  }

  if (airgap || provider === 'ollama') {
    // Use multilingual model if requested
    const model = multilingual ? 'snowflake-arctic-embed' : 'nomic-embed-text';
    return new OllamaEmbeddings({ model });
  }

  switch (provider) {
    case 'openai':
      // text-embedding-3-large supports 100+ languages natively
      const model = multilingual ? 'text-embedding-3-large' : 'text-embedding-3-small';
      return new OpenAIEmbeddings({ apiKey: await getKey('openai'), model });
    case 'mistral':
    default:
      return new MistralAIEmbeddings({ apiKey: await getKey('mistral') });
  }
}

export async function getLLM(options = {}) {
  let provider = overrideProvider || options.provider || config.get('provider');
  const airgap = options.airgap || false;
  const temperature = options.temperature || config.get('temperature');
  const model = options.model || config.get('model');

  // 1. Force Airgap (Local Only)
  if (!overrideProvider && (airgap || provider === 'ollama')) {
    const overrode = await checkOllama(airgap);
    if (overrode) provider = overrideProvider;
  }

  if (airgap || provider === 'ollama') {
    return new ChatOllama({ baseUrl: 'http://localhost:11434', model, temperature });
  }

  // 2. Cloud Providers
  switch (provider) {
    case 'mistral':
      return new ChatMistralAI({ apiKey: await getKey('mistral'), model: 'mistral-large-latest', temperature });
    case 'openai':
      const modelName = routeModel(options.prompt || '', options);
      return new ChatOpenAI({ 
        apiKey: await getKey('openai'), 
        modelName, 
        temperature,
        callbacks: [
          {
            handleLLMEnd: async (output) => {
              const { promptTokens, completionTokens } = output.llmOutput.tokenUsage;
              await recordUsage(modelName, promptTokens, completionTokens);
            }
          }
        ]
      });
    case 'anthropic':
      return new ChatAnthropic({ apiKey: await getKey('anthropic'), model: model || 'claude-3-5-sonnet-20240620', temperature });
    case 'gemini':
      return new ChatGoogleGenerativeAI({ apiKey: await getKey('gemini'), model: model || 'gemini-1.5-pro', temperature });
    default:
      // Final attempt at Ollama if provider is unknown
      return new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'llama3', temperature });
  }
}

export async function detectPersona(prompt, options = {}) {
  const llm = await getLLM(options);
  const response = await llm.invoke([
    ['system', 'Classify user intent into: scholar, coder, analyst, writer. Output ONLY the persona name.'],
    ['user', prompt]
  ]);
  const persona = response.content.toLowerCase().trim();
  return ['scholar', 'coder', 'analyst', 'writer'].includes(persona) ? persona : 'scholar';
}

