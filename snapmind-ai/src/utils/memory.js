import config from './config.js';

/**
 * Trims conversation history to the configured memory window.
 * @param {Array<{role: string, content: string}>} history
 * @param {number} [maxMessages]
 */
export function trimHistory(history, maxMessages = null) {
  const limit = maxMessages ?? config.get('memoryWindow') ?? 20;
  if (!history || history.length === 0) return [];
  if (history.length <= limit) return history;
  return history.slice(-limit);
}

/**
 * Builds LangChain-style message tuples with optional trimmed history.
 */
export function buildMessages({ system, history = [], user, maxMessages = null }) {
  const messages = [];
  if (system) messages.push(['system', system]);
  for (const entry of trimHistory(history, maxMessages)) {
    const role = entry.role === 'assistant' ? 'assistant' : 'user';
    messages.push([role, entry.content]);
  }
  if (user) messages.push(['user', user]);
  return messages;
}
