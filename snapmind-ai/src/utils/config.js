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
};

const config = new Conf({
  projectName: 'snapmind-ai',
  schema,
});

export default config;
