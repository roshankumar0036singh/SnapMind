import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatMistralAI, MistralAIEmbeddings } from '@langchain/mistralai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { requireApiKey } from './credentials.js';
import config from './config.js';
import chalk from 'chalk';
import { SnapMindError } from './errors.js';
import { routeModel } from './router.js';
import { recordUsage } from './monitor.js';
import { apiClient } from './api_client.js';

let overrideProvider = null;

function formatMessages(messages) {
  return messages.map((m) => {
    if (Array.isArray(m)) return { role: m[0], content: m[1] };
    return {
      role: m.role || (m._getType?.() === 'system' ? 'system' : (m._getType?.() === 'human' ? 'user' : 'assistant')),
      content: m.content || m.text || '',
    };
  });
}

class RemoteLLM {
  constructor(options = {}) {
    this.options = options;
  }

  buildChatPayload(messages) {
    const formatted = formatMessages(messages);
    const systemInstruction = formatted
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const dialogue = formatted.filter((m) => m.role !== 'system');
    const lastMessage = dialogue[dialogue.length - 1];
    const history = dialogue.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    return {
      query: lastMessage?.content || '',
      history,
      page_content: systemInstruction || undefined,
      persona: this.options.persona,
      temperature: this.options.temperature,
      session_id: this.options.session_id,
    };
  }

  async invoke(messages) {
    const payload = this.buildChatPayload(messages);
    const response = await apiClient.chat(payload.query, payload.session_id, payload);
    return { content: response.answer || response.response || '' };
  }

  async stream(messages) {
    const payload = this.buildChatPayload(messages);
    return apiClient.chatStream(payload.query, payload.session_id, payload);
  }
}

async function checkOllama(airgap) {
  try {
    const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
    if (!(response && response.status === 200)) {
      if (airgap) throw new SnapMindError('Ollama not running! Airgap mode requires local Ollama.', 'LOCAL_OFFLINE');

      if (!process.stdout.isTTY) {
        throw new SnapMindError(
          'Ollama not running! Background tasks cannot prompt for fallback. Ensure Ollama is running.',
          'OLLAMA_OFFLINE'
        );
      }

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
            { name: 'Exit', value: 'exit' },
          ],
        },
      ]);

      const validChoices = ['openai', 'gemini', 'anthropic', 'mistral', 'retry', 'exit'];
      const normalizedAction = (action || '').toString().toLowerCase();

      if (!validChoices.includes(normalizedAction)) {
        console.log(
          chalk.red(
            `\n❌ Invalid choice: "${action}". You must type the exact name of the provider (e.g. "openai" or "mistral") if your terminal arrow keys are broken.`
          )
        );
        return checkOllama(airgap);
      }

      if (normalizedAction === 'exit') {
        process.exit(1);
      }
      if (normalizedAction === 'retry') {
        return checkOllama(airgap);
      }

      overrideProvider = normalizedAction;
      console.log(chalk.cyan(`\nSwitching to ${normalizedAction.toUpperCase()}...`));
      await requireApiKey(normalizedAction);
      return true;
    }
    return false;
  } catch (e) {
    if (airgap) throw e;
    return false;
  }
}

async function createCloudEmbeddings(provider, multilingual) {
  const openAiModel = multilingual ? 'text-embedding-3-large' : 'text-embedding-3-small';

  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddings({
        apiKey: await requireApiKey('openai'),
        model: openAiModel,
      });
    case 'mistral':
      return new MistralAIEmbeddings({ apiKey: await requireApiKey('mistral') });
    case 'anthropic':
    case 'gemini':
      console.log(
        chalk.gray(`  [Embeddings] ${provider} has no native embeddings in SnapMind; using OpenAI embeddings.`)
      );
      return new OpenAIEmbeddings({
        apiKey: await requireApiKey('openai'),
        model: openAiModel,
      });
    default:
      return new MistralAIEmbeddings({ apiKey: await requireApiKey('mistral') });
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
    const model = multilingual ? 'snowflake-arctic-embed' : 'nomic-embed-text';
    return new OllamaEmbeddings({ model });
  }

  return createCloudEmbeddings(provider, multilingual);
}

export async function getLLM(options = {}) {
  let provider = overrideProvider || options.provider || config.get('provider');
  const airgap = options.airgap || false;
  const temperature = options.temperature ?? config.get('temperature');
  const model = options.model || config.get('model') || 'llama3';
  const mode = config.get('mode') || 'local';

  if (mode === 'remote') {
    return new RemoteLLM({ ...options, temperature, model });
  }

  if (!overrideProvider && (airgap || provider === 'ollama')) {
    const overrode = await checkOllama(airgap);
    if (overrode) provider = overrideProvider;
  }

  if (airgap || provider === 'ollama') {
    return new ChatOllama({ baseUrl: 'http://localhost:11434', model, temperature });
  }

  switch (provider) {
    case 'mistral':
      return new ChatMistralAI({
        apiKey: await requireApiKey('mistral'),
        model: options.model || config.get('model') || 'mistral-small-latest',
        temperature,
      });
    case 'openai': {
      const modelName = routeModel(options.prompt || '', options);
      return new ChatOpenAI({
        apiKey: await requireApiKey('openai'),
        modelName,
        temperature,
        callbacks: [
          {
            handleLLMEnd: async (output) => {
              const usage = output.llmOutput?.tokenUsage;
              if (!usage) return;
              const { promptTokens, completionTokens } = usage;
              await recordUsage(modelName, promptTokens, completionTokens);
            },
          },
        ],
      });
    }
    case 'anthropic':
      return new ChatAnthropic({
        apiKey: await requireApiKey('anthropic'),
        model: model || 'claude-3-5-sonnet-20240620',
        temperature,
      });
    case 'gemini':
      return new ChatGoogleGenerativeAI({
        apiKey: await requireApiKey('gemini'),
        model: model || 'gemini-1.5-pro',
        temperature,
      });
    default:
      return new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'llama3', temperature });
  }
}

export async function detectPersona(prompt, options = {}) {
  const llm = await getLLM(options);
  const response = await llm.invoke([
    ['system', 'Classify user intent into: scholar, coder, analyst, writer. Output ONLY the persona name.'],
    ['user', prompt],
  ]);
  const persona = response.content.toLowerCase().trim();
  return ['scholar', 'coder', 'analyst', 'writer'].includes(persona) ? persona : 'scholar';
}

export function buildCliOptions(commanderOptions = {}) {
  return {
    airgap: commanderOptions.airgap || false,
    multilingual: commanderOptions.multilingual || false,
    mount: commanderOptions.mount,
    watch: commanderOptions.watch,
    repo: commanderOptions.repo,
    persona: commanderOptions.persona,
    pages: commanderOptions.pages,
    pipe: commanderOptions.pipe,
  };
}
