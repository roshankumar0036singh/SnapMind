const { exec } = require('child_process');

/**
 * Manages the Ollama local LLM engine.
 * Ensures Ollama is installed and the required models are pulled.
 */
class OllamaService {
  constructor() {
    this.status = 'stopped';
    this.models = [];
    this.requiredModel = 'llama3';
  }

  async start() {
    this.status = 'starting';
    console.log('[LLM] Attempting to start Ollama Service...');

    try {
      if (await this.checkOllamaInstalled()) {
        await this.ensureModelPulled(this.requiredModel);
        this.status = 'running';
        return { success: true, status: 'running' };
      }
    } catch (e) {
      console.error('[LLM] Ollama failed to start:', e.message);
      this.status = 'error';
      return { success: false, error: e.message };
    }
  }

  async checkOllamaInstalled() {
    return new Promise((resolve) => {
      exec('ollama list', (error, stdout) => {
        if (error) {
          console.log('[LLM] Ollama is not installed or not running.');
          resolve(false);
          return;
        }
        
        // Parse models
        const lines = stdout.split('\n').slice(1); // skip header
        this.models = lines
          .map(line => line.split(' ')[0])
          .filter(Boolean);
          
        console.log(`[LLM] Ollama is running. Found models: ${this.models.join(', ')}`);
        resolve(true);
      });
    });
  }

  async ensureModelPulled(modelName) {
    if (this.models.includes(`${modelName}:latest`) || this.models.includes(modelName)) {
      console.log(`[LLM] Model '${modelName}' is already available.`);
      return;
    }

    console.log(`[LLM] Pulling required model '${modelName}'. This may take a while depending on network speed...`);
    
    // Using exec for simplicity. A real app might stream the output back to the UI.
    return new Promise((resolve, reject) => {
      exec(`ollama pull ${modelName}`, (error) => {
        if (error) {
          console.error(`[LLM] Error pulling ${modelName}:`, error);
          reject(error);
        } else {
          console.log(`[LLM] Successfully pulled ${modelName}.`);
          this.models.push(modelName);
          resolve();
        }
      });
    });
  }

  getStatus() {
    return {
      status: this.status,
      models: this.models
    };
  }
}

module.exports = new OllamaService();
