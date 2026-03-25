import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { ChatMistralAI } from '@langchain/mistralai';
import { getMistralKey } from './credentials.js';
import chalk from 'chalk';

export async function getLLM(options = {}) {
  const { airgap = false, modelName = 'llama3', temperature = 0.3 } = options;

  // 1. Try Ollama (Local) first
  if (!airgap) {
    try {
      const ollama = new ChatOllama({
        baseUrl: 'http://localhost:11434',
        model: modelName,
        temperature,
      });

      // Quick ping to see if Ollama is actually running
      const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
      
      if (response && response.status === 200) {
        return ollama;
      } else {
        console.log(chalk.yellow('⚠️ Local Ollama not detected. Falling back to Mistral API...'));
      }
    } catch (e) {
      console.log(chalk.yellow('⚠️ Local Ollama error. Falling back to Mistral API...'));
    }
  }

  // 2. Fallback to Mistral (Cloud)
  const mistralKey = await getMistralKey();
  
  if (mistralKey) {
    return new ChatMistralAI({
      apiKey: mistralKey,
      model: 'mistral-large-latest',
      temperature,
    });
  }

  throw new Error('No LLM available. Please start Ollama or provide a Mistral API key.');
}
