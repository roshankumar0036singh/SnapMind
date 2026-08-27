'use client';

import { readProviderKeys, writeProviderKeys } from '@/lib/api-client';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { ProviderId, ProviderKeys } from '@/lib/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * User-level preferences. BYOK provider keys live in localStorage under the
 * user's own control (matching the extension's BYOK model) and are attached to
 * outbound requests by api-client.
 */

export type RetrievalPrefs = {
  reranking: boolean;
  graphRag: boolean;
  queryEnhancement: boolean;
  queryNotebook: boolean;
};

export type Prefs = {
  outputLang: string;
  personaId: string | null;
  retrieval: RetrievalPrefs;
};

/**
 * Per-workspace overrides.
 *
 * Only the two preferences that are genuinely a property of a project live here:
 * what language its answers come back in, and which persona writes them. The
 * retrieval knobs stay global because the chat composer toggles them per
 * question — a workspace-level copy would fight the control the reader is
 * actually holding.
 *
 * These are browser-local by necessity, not by choice: `workspaces.metadata` is
 * written once at creation and `workspaces.py` exposes no update route, so there
 * is nowhere on the server to put them. Every screen that offers them says so.
 */
export type WorkspacePrefs = {
  outputLang?: string;
  personaId?: string | null;
};

const PREFS_STORAGE = 'snapmind.prefs';
const WS_PREFS_STORAGE = 'snapmind.prefs.workspaces';

const DEFAULT_PREFS: Prefs = {
  outputLang: 'auto',
  personaId: null,
  retrieval: {
    reranking: true,
    graphRag: false,
    queryEnhancement: false,
    queryNotebook: false,
  },
};

export const OUTPUT_LANGUAGES = [
  { value: 'auto', label: "Match the question's language" },
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Arabic', label: 'Arabic' },
] as const;

export const PROVIDERS: {
  id: ProviderId;
  label: string;
  purpose: string;
  /** Key name as reported by GET /api/v1/status/keys */
  statusKey: string;
  docsUrl: string;
}[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    purpose: 'Embeddings and generation',
    statusKey: 'GEMINI_API_KEY',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    purpose: 'Generation, reranking, entity extraction',
    statusKey: 'MISTRAL_API_KEY',
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    purpose: 'Web scraping and search',
    statusKey: 'FIRECRAWL_API_KEY',
    docsUrl: 'https://www.firecrawl.dev/app/api-keys',
  },
  {
    id: 'lingodev',
    label: 'Lingo.dev',
    purpose: 'Translation pipeline',
    statusKey: 'LINGODEV_API_KEY',
    docsUrl: 'https://lingo.dev',
  },
  {
    id: 'groq',
    label: 'Groq',
    purpose: 'Vision analysis and OCR',
    statusKey: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/keys',
  },
];

type SettingsContextValue = {
  keys: ProviderKeys;
  setKey: (id: ProviderId, value: string) => void;
  clearKey: (id: ProviderId) => void;
  /** The active workspace's overrides already merged in — read this. */
  prefs: Prefs;
  /** The account-wide defaults, unmerged. Settings edits these. */
  globalPrefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  setRetrieval: (patch: Partial<RetrievalPrefs>) => void;
  /** Every workspace's overrides, keyed by workspace id. */
  workspaceOverrides: Record<string, WorkspacePrefs>;
  /** Overrides for the *active* workspace, so a screen can show set-vs-inherited. */
  workspacePrefs: WorkspacePrefs;
  /** Pass `null` to clear a workspace's overrides entirely. */
  setWorkspaceOverride: (workspaceId: string, patch: WorkspacePrefs | null) => void;
  /** False until localStorage has been read, so inputs don't flash empty. */
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [keys, setKeys] = useState<ProviderKeys>({});
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [overrides, setOverrides] = useState<Record<string, WorkspacePrefs>>({});
  const [hydrated, setHydrated] = useState(false);

  // Reading the workspace is safe here: WorkspaceProvider sits in the root
  // layout, above the (generator) layout that mounts this provider.
  const { activeWorkspace } = useWorkspace();
  const activeId = activeWorkspace?.id;

  // Read on mount only — localStorage is unavailable during SSR.
  useEffect(() => {
    setKeys(readProviderKeys());
    try {
      const raw = window.localStorage.getItem(PREFS_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        setPrefsState({
          ...DEFAULT_PREFS,
          ...parsed,
          retrieval: { ...DEFAULT_PREFS.retrieval, ...(parsed.retrieval ?? {}) },
        });
      }
    } catch {
      /* corrupt or blocked storage — fall back to defaults */
    }
    try {
      const raw = window.localStorage.getItem(WS_PREFS_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, WorkspacePrefs>;
        if (parsed && typeof parsed === 'object') setOverrides(parsed);
      }
    } catch {
      /* same */
    }
    setHydrated(true);
  }, []);

  const persistPrefs = useCallback((next: Prefs) => {
    setPrefsState(next);
    try {
      window.localStorage.setItem(PREFS_STORAGE, JSON.stringify(next));
    } catch {
      /* non-fatal */
    }
  }, []);

  const setKey = useCallback((id: ProviderId, value: string) => {
    setKeys((prev) => {
      const next = { ...prev, [id]: value.trim() };
      if (!next[id]) delete next[id];
      writeProviderKeys(next);
      return next;
    });
  }, []);

  const clearKey = useCallback((id: ProviderId) => {
    setKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      writeProviderKeys(next);
      return next;
    });
  }, []);

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => persistPrefs({ ...prefs, ...patch }),
    [prefs, persistPrefs],
  );

  const setRetrieval = useCallback(
    (patch: Partial<RetrievalPrefs>) =>
      persistPrefs({ ...prefs, retrieval: { ...prefs.retrieval, ...patch } }),
    [prefs, persistPrefs],
  );

  const setWorkspaceOverride = useCallback(
    (workspaceId: string, patch: WorkspacePrefs | null) => {
      setOverrides((prev) => {
        const next = { ...prev };
        if (patch === null) {
          delete next[workspaceId];
        } else {
          const merged: WorkspacePrefs = { ...(prev[workspaceId] ?? {}), ...patch };
          // `undefined` in a patch means "go back to inheriting", so drop the key
          // rather than storing a hole that would still read as an override.
          for (const k of Object.keys(merged) as (keyof WorkspacePrefs)[]) {
            if (merged[k] === undefined) delete merged[k];
          }
          if (Object.keys(merged).length === 0) delete next[workspaceId];
          else next[workspaceId] = merged;
        }
        try {
          window.localStorage.setItem(WS_PREFS_STORAGE, JSON.stringify(next));
        } catch {
          /* non-fatal */
        }
        return next;
      });
    },
    [],
  );

  const workspacePrefs = useMemo<WorkspacePrefs>(
    () => (activeId ? (overrides[activeId] ?? {}) : {}),
    [overrides, activeId],
  );

  /**
   * What every consumer reads. Only the keys a workspace actually set are
   * applied, so clearing an override falls straight back to the account default.
   */
  const effective = useMemo<Prefs>(() => {
    if (!activeId) return prefs;
    const o = overrides[activeId];
    if (!o) return prefs;
    return {
      ...prefs,
      ...(o.outputLang !== undefined ? { outputLang: o.outputLang } : {}),
      ...(o.personaId !== undefined ? { personaId: o.personaId } : {}),
    };
  }, [prefs, overrides, activeId]);

  const value = useMemo(
    () => ({
      keys,
      setKey,
      clearKey,
      prefs: effective,
      globalPrefs: prefs,
      setPrefs,
      setRetrieval,
      workspaceOverrides: overrides,
      workspacePrefs,
      setWorkspaceOverride,
      hydrated,
    }),
    [
      keys,
      setKey,
      clearKey,
      effective,
      prefs,
      setPrefs,
      setRetrieval,
      overrides,
      workspacePrefs,
      setWorkspaceOverride,
      hydrated,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
