export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type IngestResult = {
  namespace: string;
  resolvedNamespace: string;
  type: 'pdf' | 'code' | 'data' | string;
  chunks: number;
  path: string;
};

export type RetrievalAssessment = {
  ok: boolean;
  reason: string | null;
  bestScore: number;
};

export type RepoSyncResult = {
  synced: boolean;
  reason?: string;
  updated: number;
  removed: number;
};

export type PluginCatalogEntry = {
  id: string;
  name?: string;
  description?: string;
  bundle?: string;
  url?: string;
  author?: string;
  version?: string;
};

export declare function getLLM(options?: Record<string, unknown>): Promise<unknown>;
export declare function getEmbeddings(options?: Record<string, unknown>): Promise<unknown>;
export declare function buildCliOptions(options?: Record<string, unknown>): Record<string, unknown>;
export declare function detectPersona(prompt: string, options?: Record<string, unknown>): Promise<string>;

export declare function generateNamespace(targetPath: string): string;
export declare function legacyNamespace(targetPath: string): string;
export declare function resolveNamespace(targetPath: string): Promise<string>;
export declare function listNamespaces(): Promise<string[]>;
export declare function namespaceExists(namespace: string): Promise<boolean>;
export declare function getVectorStore(namespace: string, embeddings: unknown): Promise<unknown>;
export declare function globalSearch(query: string, embeddings: unknown, k?: number, session_id?: string | null): Promise<unknown[]>;
export declare function retrieveContext(query: string, namespace: string, embeddings: unknown, k?: number, options?: Record<string, unknown>): Promise<unknown[]>;
export declare function personaSearch(vectorStore: unknown, query: string, k?: number, options?: Record<string, unknown>): Promise<unknown[]>;
export declare function sortSearchResults(results: Array<{ score?: number }>, k?: number): unknown[];

export declare function ingestSource(targetPath: string, options?: Record<string, unknown>): Promise<IngestResult>;
export declare const INGEST_TYPES: readonly ['auto', 'pdf', 'code', 'data'];

export declare function trimHistory(history: ChatMessage[], maxMessages?: number | null): ChatMessage[];
export declare function buildMessages(args: {
  system?: string;
  history?: ChatMessage[];
  user?: string;
  maxMessages?: number | null;
}): Array<[string, string]>;

export declare function assessRetrieval(results: Array<{ score?: number }>, options?: Record<string, unknown>): RetrievalAssessment;
export declare function formatGroundingRefusal(reason: string): string;

export declare function syncRepoIndex(repoPath: string, vectorStore: unknown): Promise<RepoSyncResult>;
export declare function getRepoChanges(repoPath: string): Promise<{ changed: string[]; deleted: string[] } | null>;
export declare function indexCodeFile(vectorStore: unknown, filePath: string, repoRoot?: string): Promise<number>;

export declare function listCatalogPlugins(registryUrl?: string | null): Promise<PluginCatalogEntry[]>;
export declare function installCatalogPlugin(id: string, registryUrl?: string | null): Promise<string>;
export declare function searchCatalogPlugins(query: string, registryUrl?: string | null): Promise<PluginCatalogEntry[]>;

export declare function loadSession(namespace: string, name?: string, legacyNs?: string | null): Promise<ChatMessage[]>;
export declare function saveSession(namespace: string, history: ChatMessage[], name?: string): Promise<void>;
export declare function loadSessionForPath(targetPath: string, name?: string): Promise<ChatMessage[]>;

export declare const CACHE_DIR: string;
export declare const LANCE_DIR: string;
export declare const SESSION_DIR: string;
export declare const EXPORT_DIR: string;

export declare const config: {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  store: Record<string, unknown>;
};

export declare class SnapMindError extends Error {
  code: string;
  constructor(message: string, code: string);
}

export declare function startScholar(options?: Record<string, unknown>): Promise<unknown>;
export declare function startCoder(options?: Record<string, unknown>): Promise<unknown>;
export declare function startAnalyst(options?: Record<string, unknown>): Promise<unknown>;
export declare function startWriter(options?: Record<string, unknown>): Promise<unknown>;
