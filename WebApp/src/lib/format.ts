import type { SourceKind } from './types';

/* --------------------------------- source --------------------------------- */

/** Classify a source URL into a display kind. Mirrors the backend's parser routing. */
export function sourceKind(url?: string | null): SourceKind {
  if (!url) return 'text';
  const u = url.toLowerCase();
  if (/^(data:image|blob:)/.test(u) || /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/.test(u)) return 'image';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('github.com')) return 'github';
  if (/\.pdf(\?|#|$)/.test(u)) return 'pdf';
  if (/\.docx?(\?|#|$)/.test(u)) return 'docx';
  if (/\.csv(\?|#|$)/.test(u)) return 'csv';
  if (/^https?:\/\//.test(u)) return 'web';
  return 'text';
}

export const SOURCE_LABELS: Record<SourceKind, string> = {
  web: 'Web page',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  pdf: 'PDF',
  docx: 'Document',
  csv: 'Spreadsheet',
  github: 'Repository',
  text: 'Text',
  image: 'Image',
};

/** Tailwind classes per source kind, following the sidebar's established accent convention. */
export const SOURCE_ACCENT: Record<SourceKind, string> = {
  web: 'text-primary-600 bg-primary-50 dark:bg-primary-500/10',
  youtube: 'text-red-600 bg-red-50 dark:bg-red-500/10',
  twitter: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10',
  pdf: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10',
  docx: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
  csv: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
  github: 'text-gray-700 bg-gray-100 dark:text-gray-200 dark:bg-white/10',
  text: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10',
  image: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
};

/** Human-friendly label for a URL: hostname + trimmed path, or the raw string if unparseable. */
export function prettyUrl(url?: string | null, maxLen = 64): string {
  if (!url) return 'Untitled';
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    const out = `${u.hostname.replace(/^www\./, '')}${path}`;
    return out.length > maxLen ? `${out.slice(0, maxLen - 1)}…` : out;
  } catch {
    return url.length > maxLen ? `${url.slice(0, maxLen - 1)}…` : url;
  }
}

export function hostname(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/* ---------------------------------- time ---------------------------------- */

export function relativeTime(input?: string | number | Date | null): string {
  if (!input) return '';
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (abs < min) return 'just now';
  if (abs < hour) return `${Math.round(abs / min)}m ago`;
  if (abs < day) return `${Math.round(abs / hour)}h ago`;
  if (abs < 7 * day) return `${Math.round(abs / day)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(then).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function absoluteTime(input?: string | number | Date | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** YYYY-MM-DD in local time — used to bucket activity charts. */
export function dayKey(input?: string | number | Date | null): string {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Human label for the day a timestamp falls on — the display half of `dayKey`.
 * Group by the key, label with this: two entries on the same day must never
 * render two headings just because they were written seconds apart.
 */
export function dayLabel(input?: string | number | Date | null): string {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) return 'Earlier';

  const today = dayKey();
  const key = dayKey(d);
  if (key === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday)) return 'Yesterday';

  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/* --------------------------------- numbers -------------------------------- */

export function compactNumber(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 1000) return String(n);
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function percent(n?: number | null, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/* -------------------------------- citations ------------------------------- */

/**
 * Derive a short display handle from a backend block id.
 * The backend emits ids like "db-block-1", "nb-block-3", "br-block-1712-5", "pin-t0-5".
 * We render initials of the source title when available, else a prefix-derived label.
 */
const PREFIX_LABELS: Record<string, string> = {
  db: 'KB',
  nb: 'NB',
  br: 'WEB',
  pin: 'PIN',
  hop: 'HOP',
  local: 'PAGE',
};

export function citationHandle(id: string, title?: string | null): string {
  // `local` is the one id with no numeric suffix and no dash (search.py:58).
  if (id === 'local') return 'PAGE';

  // The group digits are for the `hop1-db-block-2` form: deep research prefixes
  // each step's citations with its own hop number (reasoning_chain.py:177), so
  // two steps can both cite "block 2" and the hop number is what tells them
  // apart.
  const m = /^([a-z]+)(\d*)-/.exec(id);
  const prefix = m?.[1] ?? '';
  const group = m?.[2] ?? '';
  const n = /(\d+)\s*$/.exec(id)?.[1] ?? '';

  if (title) {
    const initials = title
      .replace(/https?:\/\//, '')
      .split(/[\s\-_/.]+/)
      .filter((w) => /[a-z0-9]/i.test(w))
      .slice(0, 4)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
    if (initials.length >= 2) return `${initials} ${n}`.trim();
  }

  const label = PREFIX_LABELS[prefix] || prefix.toUpperCase() || 'SRC';
  return `${label} ${group ? `${group}.${n}` : n}`.trim();
}

/**
 * Matches single-bracket block ids the model emits.
 * Prefixes verified in the backend: `db-block-N` (search_service.py:297),
 * `nb-block-N` (:454), `br-block-{run}-N` / `br-block-local-N` / `br-block-force-N`
 * (browser_agents.py:355-597), `hop-N` (search_service.py:87), the deep-research
 * form `hop{N}-{inner}` (reasoning_chain.py:177 — note there is no dash after
 * `hop` there, which is why the digits are optional), `pin-tN-M`, and the bare
 * `local` used when answering from page content (search.py:58).
 */
export const CITATION_RE = /\[((?:db|nb|br|pin|hop)\d*-[a-z0-9-]*\d|local)\]/gi;

/**
 * Build a deep link that scrolls the source to the cited text.
 * PDFs use `#page=N`; everything else uses a W3C text fragment.
 */
export function citationHref(url?: string | null, snippet?: string | null, page?: number): string {
  if (!url) return '#';
  if (page && sourceKind(url) === 'pdf') return `${url}#page=${page}`;
  if (!snippet) return url;

  // Text fragments are brittle on long strings — take a distinctive opening clause.
  const clean = snippet
    .replace(/\s+/g, ' ')
    .replace(/\[[a-z0-9-]+\]/gi, '')
    .trim()
    .slice(0, 90);
  if (clean.length < 12) return url;
  return `${url}#:~:text=${encodeURIComponent(clean)}`;
}

/* ---------------------------------- misc ---------------------------------- */

export function truncate(s?: string | null, n = 180): string {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Stable-ish id for client-side records. Avoids a uuid dependency. */
export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
