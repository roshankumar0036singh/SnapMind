import axios from 'axios';
import config from './config.js';
import { getOptionalKey } from './credentials.js';

class ApiClient {
  constructor() {
    this.baseUrl = config.get('backendUrl').replace(/\/$/, '');
  }

  apiPath(segment) {
    return `${this.baseUrl}/api/v1/${segment.replace(/^\//, '')}`;
  }

  async getHeaders(providers = ['mistral', 'gemini']) {
    const headers = { 'Content-Type': 'application/json' };
    const optionalKeys = ['firecrawl', 'lingodev', 'groq', 'openai', 'anthropic'];

    for (const provider of providers) {
      const key = await getOptionalKey(provider);
      if (key) headers[`x-${provider}-key`] = key;
    }

    for (const provider of optionalKeys) {
      const key = await getOptionalKey(provider);
      if (key) headers[`x-${provider}-key`] = key;
    }

    return headers;
  }

  mapSourcesToResults(sources = []) {
    return sources.map((s) => ({
      content: s.content,
      source_url: s.url,
      score: s.combined_score ?? s.similarity ?? 0,
      metadata: s.metadata || {},
      site_id: s.metadata?.site_id || s.metadata?.namespace,
    }));
  }

  async search(query, limit = 5, session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      this.apiPath('search/chat'),
      { query, session_id, history: [] },
      { headers }
    );
    const data = response.data;

    return {
      success: true,
      answer: data.answer,
      results: this.mapSourcesToResults(data.sources).slice(0, limit),
    };
  }

  async chat(query, session_id = null, options = {}) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      this.apiPath('search/chat'),
      { query, session_id, ...options },
      { headers }
    );
    const data = response.data;
    return { response: data.answer, answer: data.answer, sources: data.sources, session_id: data.session_id };
  }

  async *chatStream(query, session_id = null, options = {}) {
    const headers = await this.getHeaders();
    const response = await fetch(this.apiPath('search/chat/stream'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, session_id, ...options }),
    });

    if (!response.ok) {
      throw new Error(`Remote stream failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'token' && event.text) {
            yield { content: event.text };
          }
        } catch {
          // Skip malformed stream chunks.
        }
      }
    }
  }

  async ingestWebsite(url, target_lang = 'auto', session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      this.apiPath('ingest'),
      { url, target_lang, session_id },
      { headers }
    );
    return response.data;
  }

  async ingestGithub(repo_url, target_lang = 'auto', session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      this.apiPath('ingest/github'),
      { url: repo_url, target_lang, session_id },
      { headers }
    );
    return response.data;
  }

  async ingestYouTube(url, target_lang = 'auto', session_id = null) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      this.apiPath('ingest'),
      { url, target_lang, session_id },
      { headers }
    );
    return response.data;
  }

  async getIngestStatus(session_id) {
    const response = await axios.get(this.apiPath(`ingest/status/${session_id}`));
    return response.data;
  }

  async getSessions() {
    const response = await axios.get(this.apiPath('graph/sessions'));
    return response.data;
  }
}

export const apiClient = new ApiClient();
