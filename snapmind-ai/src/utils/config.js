import Conf from 'conf';

const schema = {
  provider: {
    type: 'string',
    default: 'ollama',
  },
  model: {
    type: 'string',
    default: 'llama3',
  },
  temperature: {
    type: 'number',
    default: 0.3,
  },
  multilingual: {
    type: 'boolean',
    default: false,
  },
  // Phase 4: Intelligence Bridge
  mode: {
    type: 'string',
    default: 'local', // 'local' (LanceDB) or 'remote' (FastAPI backend)
    enum: ['local', 'remote'],
  },
  backendUrl: {
    type: 'string',
    default: 'http://localhost:8000',
  },
  hybridSearch: {
    type: 'boolean',
    default: true,
  },
  memoryWindow: {
    type: 'number',
    default: 20,
  },
  citationGrounding: {
    type: 'boolean',
    default: true,
  },
  pluginRegistryUrl: {
    type: 'string',
    default: '',
  },
};

const config = new Conf({
  projectName: 'snapmind-ai',
  schema,
});

export default config;
