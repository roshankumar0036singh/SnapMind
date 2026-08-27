/**
 * Pure helpers for the research surfaces.
 *
 * The research router returns three different evidence shapes, and none of them
 * is the `RetrievedBlock` the chat components render:
 *
 *   - `blocks[]`      body in `text`, `url` already a `#:~:text=` deep link
 *                     (browser_agents.py:610)
 *   - `citations[]`   pointers only — `{blockId, snippet, highlightUrl}` where
 *                     `snippet` is the bare URL (browser_agents.py:606)
 *   - `sources[]`     on debate and cross-lingual, these are *citations*, not
 *                     blocks (research.py:316, :380), so they can only be shown
 *                     as a link list — there is no text to quote
 *
 * Everything here converts inward to the one shape the rest of the dashboard
 * already knows how to draw, so the research pages reuse `Markdown`, `Citation`
 * and `MessageSources` unchanged instead of growing a second renderer.
 */

import type {
  ResearchBlock,
  ResearchCitation,
  RetrievedBlock,
} from './types';
import { hostname, prettyUrl } from './format';

/* ------------------------------- conversion ------------------------------- */

/**
 * Strip a text fragment back off a highlight URL.
 * The agent stores the deep link in `url`, so the plain address has to be
 * recovered for grouping and for the "open source" affordance.
 */
export function baseUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.split('#:~:text=')[0] || undefined;
}

/** Convert agent blocks into the block shape the chat renderer consumes. */
export function researchBlocks(blocks?: ResearchBlock[] | null): RetrievedBlock[] {
  if (!blocks?.length) return [];
  return blocks.map((b) => {
    const plain = baseUrl(b.url);
    return {
      id: b.id,
      content: b.text ?? '',
      // `url` keeps the deep link so a citation click still lands on the
      // sentence; `source_url` carries the address the UI groups and labels by.
      url: b.url,
      source_url: plain,
      title: b.title || (plain ? hostname(plain) : undefined),
      highlight_snippet: b.highlight_snippet,
      metadata: {
        source_type: b.source_type,
        youtubeUrl: b.youtubeUrl,
        timestamp_seconds: b.timestamp_seconds,
      },
    } satisfies RetrievedBlock;
  });
}

export type SourceLink = { url: string; deepLink: string; label: string };

/**
 * Collapse a `citations[]` array to one entry per source page.
 * The agent emits one citation per *chunk*, so a single article can appear eight
 * times; a reader wants the article once.
 */
export function sourceLinks(citations?: ResearchCitation[] | null): SourceLink[] {
  if (!citations?.length) return [];
  const seen = new Map<string, SourceLink>();
  for (const c of citations) {
    const url = baseUrl(c.snippet) || baseUrl(c.highlightUrl);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (!seen.has(url)) {
      seen.set(url, { url, deepLink: c.highlightUrl || url, label: prettyUrl(url, 52) });
    }
  }
  return [...seen.values()];
}

/** Distinct source pages behind a set of blocks — used for the counts pills. */
export function distinctSources(blocks: RetrievedBlock[]): number {
  const s = new Set<string>();
  for (const b of blocks) {
    const u = b.source_url || baseUrl(b.url);
    if (u) s.add(u);
  }
  return s.size;
}

/* --------------------------------- pipeline -------------------------------- */

/**
 * What the browser agent does, in order.
 *
 * This is documentation, not telemetry. `POST research/research` is one blocking
 * call and its orchestrator reports progress only to the server's stdout, so
 * there is no channel to drive a real per-stage timeline from. Rather than
 * animate a fake one, the run panel shows this list greyed with an elapsed timer
 * and says plainly that stages are not individually tracked. Deep Research is
 * the mode with genuine per-step events — use it when you want to watch.
 */
export const PIPELINE_STAGES: { name: string; detail: string }[] = [
  { name: 'Query analysis', detail: 'Rewrites your question into targeted search queries' },
  { name: 'Search', detail: 'Runs those queries across the web' },
  { name: 'Ranking', detail: 'Scores results for credibility and relevance' },
  { name: 'Scraping', detail: 'Fetches the pages that survived ranking' },
  { name: 'Slicing', detail: 'Cuts each page into citable chunks with highlight anchors' },
  { name: 'Synthesis', detail: 'Writes the answer, citing chunks inline' },
];

/**
 * The nine sections the DOCX is written to (report_generator.py:94-103).
 *
 * Copied from the generator's own prompt rather than invented, so the preview
 * matches the file that downloads. It is a *systematic research paper*, not a
 * summary — worth saying up front, because it takes minutes and reads formally.
 */
export const REPORT_OUTLINE: string[] = [
  'Title page',
  'Abstract',
  'Introduction',
  'Literature review & current landscape',
  'Methodology',
  'Core analysis & findings',
  'Discussion & implications',
  'Conclusion',
  'References',
];

/* ---------------------------------- time ---------------------------------- */

/** `m:ss` elapsed — long agent runs make a bare second count hard to read. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/* -------------------------------- languages ------------------------------- */

/**
 * Search languages for cross-lingual research.
 *
 * Separate from `OUTPUT_LANGUAGES` because 'auto' is meaningless here — the
 * whole point is to search in a language you did *not* ask in — and because
 * these are passed to the model as prose, so they are written the way the
 * backend's default is (`"Mandarin Chinese"`, research.py:330).
 */
export const SEARCH_LANGUAGES = [
  'Mandarin Chinese',
  'Spanish',
  'Hindi',
  'Arabic',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Portuguese',
  'Russian',
  'Italian',
  'Indonesian',
  'English',
] as const;
