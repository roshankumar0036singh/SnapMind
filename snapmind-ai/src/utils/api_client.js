import axios from 'axios';
import config from './config.js';
import { getKey } from './credentials.js';

class ApiClient {
  constructor() {
    this.baseUrl = config.get('backendUrl');
  }

  async getHeaders() {
    // Collect keys from system keychain
    const [gemini, mistral, firecrawl, lingodev, groq] = await Promise.all([
      getKey('gemini'),
      getKey('mistral'),
      getKey('firecrawl'),
      getKey('lingodev'),
      getKey('groq')
    ]);

    return {
      'Content-Type': 'application/json',
      'x-gemini-key': gemini,
      'x-mistral-key': mistral,
      'x-firecrawl-key': firecrawl,
      'x-lingodev-key': lingodev,
      'x-groq-key': groq
    };
  }

  async search(query, limit = 5, session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/api/search`, {
      query,
      limit,
      session_id
    }, { headers });
    return response.data;
  }

  async chat(query, session_id = null, options = {}) {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/chat`, {
      query,
      session_id,
      ...options
    }, { headers });
    return response.data;
  }

  async ingestWebsite(url, target_lang = 'auto', session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/ingest/website`, {
      url,
      target_lang,
      session_id
    }, { headers });
    return response.data;
  }

  async ingestGithub(repo_url, target_lang = 'auto', session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/ingest/github`, {
      repo_url,
      target_lang,
      session_id
    }, { headers });
    return response.data;
  }

  async ingestYouTube(url, target_lang = 'auto', session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/ingest/youtube`, {
      url,
      target_lang,
      session_id
    }, { headers });
    return response.data;
  }

  async getIngestStatus(session_id) {
    const response = await axios.get(`${this.baseUrl}/api/ingest/status/${session_id}`);
    return response.data;
  }

  async getSessions() {
    const response = await axios.get(`${this.baseUrl}/graph/sessions`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
