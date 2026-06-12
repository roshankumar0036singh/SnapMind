import os from 'os';
import path from 'path';

export const CACHE_DIR = path.join(os.homedir(), '.snapmind');

export const NLP_CONFIG = {
  SCHOLAR: {
    CHUNK_SIZE: 1000,
    CHUNK_OVERLAP: 200,
    SIMILARITY_K: 5
  },
  CODER: {
    CHUNK_SIZE: 2000,
    CHUNK_OVERLAP: 200,
    SIMILARITY_K: 4
  },
  ANALYST: {
    CHUNK_SIZE: 1000,
    CHUNK_OVERLAP: 100,
    SIMILARITY_K: 5
  },
  WRITER: {
    CHUNK_SIZE: 1500,
    CHUNK_OVERLAP: 200,
    SIMILARITY_K: 6
  }
};
