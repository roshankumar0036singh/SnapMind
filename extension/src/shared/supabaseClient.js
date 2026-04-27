import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Custom storage adapter for Chrome Extensions
const chromeStorageAdapter = {
  getItem: async (key) => {
    const result = await chrome.storage.local.get([key]);
    return result[key];
  },
  setItem: async (key, value) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key) => {
    await chrome.storage.local.remove([key]);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle the URL manually in the extension
    flowType: 'pkce',          // Explicit PKCE for deterministic code exchange
  }
});
