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
};

const config = new Conf({
  projectName: 'snapmind-ai',
  schema,
});

export default config;
