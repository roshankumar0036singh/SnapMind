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

export async function getEmbeddings(options = {}) {
  const provider = options.provider || config.get('provider');
  const airgap = options.airgap || false;
  const multilingual = options.multilingual || config.get('multilingual') || false;

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
  const provider = options.provider || config.get('provider');
  const airgap = options.airgap || false;
  const temperature = options.temperature || config.get('temperature');
  const model = options.model || config.get('model');

  // 1. Force Airgap (Local Only)
  if (airgap || provider === 'ollama') {
    try {
      const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
      if (!(response && response.status === 200)) {
        if (airgap) throw new SnapMindError('Ollama not running! Airgap mode requires local Ollama.', 'LOCAL_OFFLINE');
        console.log(chalk.yellow('⚠️ Local Ollama not detected. Attempting cloud fallback...'));
      } else {
        return new ChatOllama({ baseUrl: 'http://localhost:11434', model, temperature });
      }
    } catch (e) {
      if (airgap) throw e;
    }
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

