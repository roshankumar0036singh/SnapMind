/**
 * Shared SnapMind domain types.
 * Shapes verified against the FastAPI backend (backend/schemas.py + api/v1/endpoints/*).
 */

/* ---------------------------------- core --------------------------------- */

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
};

/** GET /api/v1/sites -> { success, sites: Site[] } */
export type Site = {
  id: string;
  url: string;
  title: string;
  last_updated_at: string;
  original_lang?: string | null;
  translated?: boolean;
  /** Number of indexed chunks for this source. */
  chunk_count?: number;
  /** Semantic tags aggregated across the source's chunks. */
  tags?: string[];
  workspace_id?: string | null;
};

/** GET /api/v1/sites/chunks/{source_url} — the embedding column is deliberately excluded. */
export type SiteChunk = {
  id: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

export type SourceKind =
  | 'web'
  | 'youtube'
  | 'twitter'
  | 'pdf'
  | 'docx'
  | 'csv'
  | 'github'
  | 'text'
  | 'image';

/** GET /api/v1/tags -> { success, tags: string[] } */
export type TagList = string[];

/* -------------------------------- retrieval ------------------------------- */

/**
 * One retrieved chunk. Mirrors backend `SearchResultDTO` (models/dtos.py:38) —
 * every scoring field is present on the wire, so keep them all: the chat UI
 * shows the credibility tier and the hybrid scores in the source drawer.
 */
export type RetrievedBlock = {
  id: string;
  content: string;
  url?: string;
  source_url?: string;
  title?: string;
  score?: number;
  similarity?: number;
  bm25_score?: number;
  combined_score?: number;
  credibility_score?: number;
  credibility_tier?: string;
  highlight_snippet?: string;
  is_reasoning_result?: boolean;
  metadata?: Record<string, unknown> & { page?: number; handle?: string };
};

export type Citation = {
  /** raw block id as emitted by the model, e.g. "db-block-1", "nb-block-3", "br-block-1712-5" */
  id: string;
  /** short display handle, e.g. "SSOC 1" */
  handle: string;
  block?: RetrievedBlock;
};

/* ---------------------------------- chat ---------------------------------- */

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
  blocks?: RetrievedBlock[];
  thoughts?: ThoughtStep[];
  metadata?: ChatMetadata;
  systemNotes?: string[];
  pending?: boolean;
  error?: string;
};

export type ChatMetadata = {
  suggestions?: string[];
  original_tokens?: number;
  optimized_tokens?: number;
  compression_ratio?: number;
  removed_duplicates?: number;
  model?: string;
  cached?: boolean;
  [k: string]: unknown;
};

/** GET /api/v1/chat/sessions */
export type ChatSession = {
  session_id: string;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  workspace_id?: string | null;
};

/** One step of the reasoning chain (backend/reasoning_chain.py:131). */
export type ThoughtStep = {
  step?: number;
  thought?: string;
  action?: string;
  status?: string;
};

/**
 * NDJSON event union emitted by POST /api/v1/search/chat/stream.
 *
 * Verified against services/search_service.py:245-357 — `thought` and `answer`
 * carry their payload under `data`, not `content`/`text`. There is no terminal
 * "done" event; the stream simply ends, so completion is detected by EOF.
 */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'answer'; data?: string; text?: string; content?: string }
  | { type: 'thought'; data?: ThoughtStep; content?: string; text?: string }
  | { type: 'retrieved_blocks'; blocks: RetrievedBlock[] }
  | {
      type: 'metadata';
      sources?: RetrievedBlock[];
      reasoning_chain?: ThoughtStep[];
      model_used?: string;
      [k: string]: unknown;
    }
  | { type: 'system_message'; content: string }
  | { type: 'error'; error?: string; content?: string };

/* -------------------------------- notebook -------------------------------- */

/** GET /api/v1/bookmarks -> { success, bookmarks: Bookmark[] } */
export type Bookmark = {
  id: string;
  content: string;
  source_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

/**
 * GET /api/v1/saved-pages -> `{ success, data: SavedPage[] }`
 *
 * This is the stored row, not the request shape: the column is `original_url`,
 * and the page text is never returned — only the summary the LLM wrote at save
 * time (saved_pages.py:16). `keywords` and `emotions` are Postgres text[], and
 * both fall back to placeholders (`["extracted","saved"]` / `["neutral"]`) when
 * no Mistral key was present for the extraction pass.
 */
export type SavedPage = {
  id: string;
  original_url: string;
  title?: string | null;
  summary?: string | null;
  folder_name?: string | null;
  keywords?: string[] | null;
  emotions?: string[] | null;
  created_at?: string;
};

/* ---------------------------------- graph --------------------------------- */

/** Cytoscape-shaped payload from GET /api/v1/graph/data */
export type GraphNode = { data: { id: string; label: string; type?: string | null } };
export type GraphEdge = { data: { source: string; target: string; label?: string | null } };
export type GraphPayload = { success?: boolean; nodes: GraphNode[]; edges: GraphEdge[] };

/** GET /api/v1/graph/sessions */
export type GraphSession = {
  session_id: string;
  title?: string | null;
  edge_count: number;
  node_count: number;
};

/* --------------------------------- vision --------------------------------- */

export type VisionMode = 'qa' | 'extraction';

export type VisionResult = {
  success: boolean;
  answer?: string;
  text?: string;
  suggestions?: string[];
  error?: string;
  [k: string]: unknown;
};

/* -------------------------------- ingestion ------------------------------- */

export type IngestCrawlMode = 'single' | 'multi';

export type IngestJobStatus = 'queued' | 'running' | 'done' | 'error';

export type IngestJob = {
  id: string;
  label: string;
  kind: SourceKind;
  status: IngestJobStatus;
  message?: string;
  chunks?: number;
  filesProcessed?: number;
  progress?: number;
  sessionId?: string;
  startedAt: number;
  finishedAt?: number;
};

/* -------------------------------- research -------------------------------- */

/** `research_mode` accepted by POST research/research (schemas.py:97). */
export type ResearchMode = 'general' | 'scholar' | 'legal';

/**
 * One evidence chunk from the browser agent (browser_agents.py:610).
 *
 * Deliberately *not* `RetrievedBlock`: this shape carries its body in `text`,
 * and its `url` is already a `#:~:text=` highlight link rather than the plain
 * source address. `researchBlocks()` in lib/research.ts converts it.
 */
export type ResearchBlock = {
  id: string;
  text?: string;
  url?: string;
  title?: string;
  /** local | web | youtube | linkedin_post — left open, the backend adds kinds. */
  source_type?: string;
  highlight_snippet?: string;
  youtubeUrl?: string;
  timestamp_seconds?: number;
};

/**
 * A `citations` entry — a *pointer*, not a chunk (browser_agents.py:606).
 * `snippet` holds the bare source URL and `highlightUrl` the deep link, which is
 * why debate and cross-lingual (whose `sources` are these) can only be rendered
 * as a link list.
 */
export type ResearchCitation = {
  blockId?: string;
  snippet?: string;
  highlightUrl?: string;
};

/** POST research/research and research/person_intelligence. */
export type BrowserRunResult = {
  answer?: string;
  citations?: ResearchCitation[];
  blocks?: ResearchBlock[];
  /** `completed` | `needs_more_info` (browser_agents.py:440) | orchestrator status. */
  status?: string;
  /** Set when the agent locked onto one authoritative page. */
  locked_url?: string | null;
};

/** POST research/deep-research — one planned hop (reasoning_chain.py:21). */
export type ReasoningPlanStep = {
  step?: number;
  question?: string;
  tool?: 'web_search' | 'local_rag' | string;
  depends_on?: number[];
};

/** One completed hop in the returned chain (reasoning_chain.py:158). */
export type ReasoningChainStep = {
  id?: string;
  thought?: string;
  action?: string;
  answer?: string;
  sources?: string[];
  status?: string;
};

export type DeepResearchResult = {
  answer?: string;
  chain?: ReasoningChainStep[];
  citations?: ResearchCitation[];
  blocks?: ResearchBlock[];
  plan?: ReasoningPlanStep[];
  thoughts?: ThoughtStep[];
};

/** NDJSON events from POST research/deep-research/stream. */
export type DeepResearchEvent =
  | { type: 'plan'; plan: ReasoningPlanStep[] }
  | { type: 'thought'; step?: number; thought?: string; action?: string; status?: string }
  | ({ type: 'final' } & DeepResearchResult)
  | { type: 'error'; error?: string };

/** POST research/debate. */
export type DebateResult = {
  success?: boolean;
  topic?: string;
  answer?: string;
  sources?: ResearchCitation[];
  pro_sources?: ResearchCitation[];
  con_sources?: ResearchCitation[];
};

/** POST research/cross_lingual. */
export type CrossLingualResult = {
  success?: boolean;
  original_query?: string;
  translated_query?: string;
  search_lang?: string;
  target_lang?: string;
  answer?: string;
  sources?: ResearchCitation[];
};

/** POST research/scrape. */
export type ScrapeResult = {
  success?: boolean;
  url?: string;
  title?: string;
  markdown?: string;
};

/** POST linkedin/parse — parses *and* ingests (linkedin.py:69). */
export type LinkedInParseResult = {
  success?: boolean;
  parsed_data?: {
    author?: string;
    author_headline?: string;
    posted_at?: string;
    content?: string;
    likes?: string | number;
    comments?: string | number;
    reposts?: string | number;
    hashtags?: string[];
    [k: string]: unknown;
  };
  ingest_result?: Record<string, unknown>;
};

/* -------------------------------- personas -------------------------------- */

export type Persona = {
  id: string;
  name: string;
  system_prompt_addon: string;
  workspace_id?: string | null;
  created_at?: string;
};

/* -------------------------------- settings -------------------------------- */

export type ProviderId = 'gemini' | 'mistral' | 'firecrawl' | 'lingodev' | 'groq';

export type ProviderKeys = Partial<Record<ProviderId, string>>;

/** GET /api/v1/status/keys */
export type KeyStatus = {
  is_configured: boolean;
  missing_keys: string[];
  recommendation?: string;
};

/** GET /api/v1/auth/keys */
export type PersonalApiKey = {
  id: string;
  name?: string;
  key_prefix?: string;
  created_at?: string;
  last_used_at?: string | null;
};

/* -------------------------------- analytics ------------------------------- */

/** GET /api/v1/admin/analytics */
export type Analytics = {
  docs?: number;
  bookmarks?: number;
  sessions?: number;
  storage?: string;
  recent?: { url: string; date: string }[];
  health?: string;
  error?: string;
};
