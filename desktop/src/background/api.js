/**
 * API Client for SnapMind Desktop.
 * Adapts extension logic to work in a standard web environment (localStorage).
 */

const DEFAULT_BACKEND_URL = "http://localhost:8000";

// Mock chrome.storage.local using localStorage
const storageShim = {
  get: (keys, callback) => {
    const res = {};
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) {
      keys.forEach(k => {
        const val = localStorage.getItem(k);
        try {
          res[k] = val ? JSON.parse(val) : undefined;
        } catch (e) {
          res[k] = val;
        }
      });
    } else {
      // keys is an object with default values
      Object.keys(keys).forEach(k => {
        const val = localStorage.getItem(k);
        try {
          res[k] = val ? JSON.parse(val) : keys[k];
        } catch (e) {
          res[k] = val || keys[k];
        }
      });
    }
    if (callback) callback(res);
    return Promise.resolve(res);
  },
  set: (items, callback) => {
    Object.keys(items).forEach(k => {
      localStorage.setItem(k, JSON.stringify(items[k]));
      // Trigger a storage event for internal listeners if needed
      window.dispatchEvent(new CustomEvent('chrome_storage_changed', { detail: { [k]: items[k] } }));
    });
    if (callback) callback();
    return Promise.resolve();
  }
};

// Helper to resolve backend URL (reusable)
async function resolveBaseUrl() {
    const storage = await storageShim.get(['backendUrl', 'useLocalBackend']);
    if (storage.useLocalBackend !== false) {
        return "http://localhost:8000";
    }
    return storage.backendUrl || DEFAULT_BACKEND_URL;
}

export const apiClient = {
    async getBaseUrl() {
        return resolveBaseUrl();
    },

    async getApiKeysHeaders() {
        const res = await storageShim.get(['geminiApiKey', 'mistralApiKey', 'lingodevApiKey', 'firecrawlApiKey', 'groqApiKey']);
        const headers = {};
        if (res.geminiApiKey) headers['x-gemini-key'] = res.geminiApiKey;
        if (res.mistralApiKey) headers['x-mistral-key'] = res.mistralApiKey;
        if (res.lingodevApiKey) headers['x-lingodev-key'] = res.lingodevApiKey;
        if (res.firecrawlApiKey) headers['x-firecrawl-key'] = res.firecrawlApiKey;
        return headers;
    },

    async chat(request) {
        const baseUrl = await this.getBaseUrl();
        const headers = await this.getApiKeysHeaders();
        const response = await fetch(`${baseUrl}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(request)
        });
        return response.json();
    },

    async getSessions() {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/sessions`);
        return response.json();
    },

    async getTags() {
        const baseUrl = await this.getBaseUrl();
        try {
            const response = await fetch(`${baseUrl}/tags`);
            if (!response.ok) return [];
            return response.json();
        } catch (e) {
            return [];
        }
    },

    async deleteSession(sessionId) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/sessions/${sessionId}`, { method: 'DELETE' });
        return response.json();
    },

    async clearAllSessions() {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/sessions`, { method: 'DELETE' });
        return response.json();
    },

    async getAnalytics() {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/admin/analytics`);
        return response.json();
    },

    async getRefreshSuggestions() {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/admin/refresh-suggestions`);
        return response.json();
    },

    async triggerRefresh(url) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/admin/refresh-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        return response.json();
    },

    async getSites() {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/sites`);
        const data = await response.json();
        return data.sites || [];
    },

    async deleteSite(id) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/sites/${id}`, { method: 'DELETE' });
        return response.json();
    },

    async getBookmarks() {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/bookmarks`);
        const data = await response.json();
        return data.bookmarks || [];
    },

    async deleteBookmark(id) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/bookmarks/${id}`, { method: 'DELETE' });
        return response.json();
    },

    async getSuggestions(pageContent, url, siteId) {
        const baseUrl = await this.getBaseUrl();
        const headers = await this.getApiKeysHeaders();
        try {
            const response = await fetch(`${baseUrl}/chat/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ page_content: pageContent, url, site_id: siteId })
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.suggestions || [];
        } catch (e) {
            console.error("Failed to fetch suggestions:", e);
            return [];
        }
    },

    async getIngestStatus(sessionId) {
        const baseUrl = await this.getBaseUrl();
        const response = await fetch(`${baseUrl}/browser/ingest_status/${sessionId}`);
        return response.json();
    }
};

// Also export the storageShim if components need direct access
export const chrome = {
    storage: {
        local: storageShim
    },

    async getSettings() {
        try {
            const baseUrl = await resolveBaseUrl();
            const response = await fetch(`${baseUrl}/admin/settings`);
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch settings:", error);
            return {};
        }
    },

    async updateSetting(key, value) {
        try {
            const baseUrl = await resolveBaseUrl();
            const response = await fetch(`${baseUrl}/admin/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            return await response.json();
        } catch (error) {
            console.error(`Failed to update setting ${key}:`, error);
            return { success: false, error: error.message };
        }
    },

    runtime: {
        lastError: null,
        onMessage: {
            _listeners: [],
            addListener: (fn) => {
                // No-op in desktop — no extension messaging
                console.log("[SHIM] chrome.runtime.onMessage.addListener registered (no-op)");
            },
            removeListener: (fn) => {
                console.log("[SHIM] chrome.runtime.onMessage.removeListener (no-op)");
            }
        },
        sendMessage: (msg, cb) => {
             console.log("[STORAGE SHIM] chrome.runtime.sendMessage called", msg);
             if (window.electronAPI) {
                 window.electronAPI.send(msg.type, msg);
             }
             if (cb) cb({status: 'ok'});
        }
    },
    tabs: {
        query: (query, cb) => {
             const tabs = [{ id: 1, url: window.location.href, title: document.title }];
             if (cb) cb(tabs);
             return Promise.resolve(tabs);
        },
        create: (data) => {
             window.open(data.url, '_blank');
        },
        sendMessage: (id, msg) => {
             console.log("[STORAGE SHIM] chrome.tabs.sendMessage called", id, msg);
        },
        onActivated: { addListener: () => {}, removeListener: () => {} },
        onUpdated: { addListener: () => {}, removeListener: () => {} }
    }
};
