'use client';

/**
 * Sources: the per-answer list, and the pinned-source tray.
 *
 * Pinning is the web equivalent of the extension's "pin tabs" — the pinned urls
 * are sent as `site_id` (a comma-separated list), which the backend turns into a
 * `source_urls` retrieval filter (api/v1/endpoints/search.py:22). So pinning two
 * documents and asking a question *is* the cross-source comparison feature; no
 * separate endpoint is involved.
 *
 * The pinned set is persisted per workspace so that closing the tab does not
 * silently widen the next question's scope back to the whole knowledge base.
 */

import { Button, EmptyState, IconButton, PANEL, SearchInput, Skeleton } from '@/components/dashboard/ui';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import { hostname, prettyUrl, SOURCE_ACCENT, SOURCE_LABELS, sourceKind } from '@/lib/format';
import type { RetrievedBlock, Site } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronDown, FileText, Layers, Pin, PinOff, Plus, Search, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { blockUrl, SourcePreview } from './citation';

/* ------------------------------ pinned state ------------------------------ */

export type PinnedSource = { url: string; title?: string };

type PinnedApi = {
  pinned: PinnedSource[];
  urls: string[];
  isPinned: (url?: string | null) => boolean;
  toggle: (source: PinnedSource) => void;
  remove: (url: string) => void;
  clear: () => void;
};

const PinnedContext = createContext<PinnedApi | null>(null);

const storageKey = (workspaceId?: string | null) => `snapmind.pinned.${workspaceId || 'all'}`;

export function PinnedSourcesProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const [pinned, setPinned] = useState<PinnedSource[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(workspaceId));
      setPinned(raw ? (JSON.parse(raw) as PinnedSource[]) : []);
    } catch {
      setPinned([]);
    }
  }, [workspaceId]);

  const commit = useCallback(
    (next: PinnedSource[]) => {
      setPinned(next);
      try {
        window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(next));
      } catch {
        /* quota or private mode — pinning still works for this session */
      }
    },
    [workspaceId],
  );

  const value = useMemo<PinnedApi>(
    () => ({
      pinned,
      urls: pinned.map((p) => p.url),
      isPinned: (url) => Boolean(url) && pinned.some((p) => p.url === url),
      toggle: (source) =>
        commit(
          pinned.some((p) => p.url === source.url)
            ? pinned.filter((p) => p.url !== source.url)
            : [...pinned, source],
        ),
      remove: (url) => commit(pinned.filter((p) => p.url !== url)),
      clear: () => commit([]),
    }),
    [pinned, commit],
  );

  return <PinnedContext.Provider value={value}>{children}</PinnedContext.Provider>;
}

/** Safe outside the provider — returns an inert store rather than throwing. */
export function usePinned(): PinnedApi {
  const ctx = useContext(PinnedContext);
  return (
    ctx ?? {
      pinned: [],
      urls: [],
      isPinned: () => false,
      toggle: () => {},
      remove: () => {},
      clear: () => {},
    }
  );
}

/* --------------------------- per-message sources -------------------------- */

export function MessageSources({ blocks }: { blocks: RetrievedBlock[] }) {
  const [open, setOpen] = useState(false);
  const { isPinned, toggle } = usePinned();

  // The same document usually contributes several chunks; collapse them so the
  // list reads as "which sources", not "which chunks".
  const grouped = useMemo(() => {
    const map = new Map<string, { block: RetrievedBlock; ids: string[] }>();
    for (const b of blocks) {
      const key = blockUrl(b) ?? b.id;
      const hit = map.get(key);
      if (hit) hit.ids.push(b.id);
      else map.set(key, { block: b, ids: [b.id] });
    }
    return [...map.values()];
  }, [blocks]);

  if (!grouped.length) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Layers className="h-3.5 w-3.5" />
        {grouped.length} source{grouped.length === 1 ? '' : 's'}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5">
          {grouped.map(({ block, ids }) => {
            const url = blockUrl(block);
            const kind = sourceKind(url);
            const pinnedNow = isPinned(url);
            return (
              <li
                key={block.id}
                className="group flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-2.5 py-2 transition hover:border-gray-200 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                    SOURCE_ACCENT[kind],
                  )}
                >
                  <FileText className="h-3 w-3" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-gray-800 dark:text-gray-100">
                    {block.title || (url ? hostname(url) : SOURCE_LABELS[kind])}
                  </p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {url ? prettyUrl(url, 52) : block.id}
                    {ids.length > 1 && ` · ${ids.length} passages`}
                  </p>
                </div>

                {url && (
                  <IconButton
                    label={pinnedNow ? 'Unpin this source' : 'Pin this source to focus retrieval'}
                    onClick={() => toggle({ url, title: block.title || hostname(url) })}
                    icon={pinnedNow ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    className={cn(
                      'opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100',
                      pinnedNow && 'opacity-100 text-primary-600 dark:text-primary-400',
                    )}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ source picker ----------------------------- */

function SourcePicker({ onClose }: { onClose: () => void }) {
  const { activeWorkspace } = useWorkspace();
  const { pinned, toggle } = usePinned();
  const [q, setQ] = useState('');

  const { data, loading } = useApi<{ sites?: Site[] }>(
    () => api.get('sites', { query: { workspace_id: activeWorkspace?.id } }),
    [activeWorkspace?.id],
  );

  const sites = useMemo(() => {
    const all = data?.sites ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 60);
    return all
      .filter((s) => `${s.title ?? ''} ${s.url}`.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [data, q]);

  return (
    <div className={cn(PANEL, 'absolute bottom-full left-0 z-40 mb-2 w-[26rem] max-w-[calc(100vw-2rem)] p-3')}>
      <div className="mb-2.5 flex items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search your sources…" className="flex-1" autoFocus />
        <IconButton label="Close" onClick={onClose} icon={<X className="h-4 w-4" />} />
      </div>

      <div className="custom-scrollbar max-h-64 space-y-1 overflow-y-auto pr-1">
        {loading && (
          <>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </>
        )}

        {!loading && !sites.length && (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title={q ? 'No source matches that' : 'Nothing indexed yet'}
            description={q ? 'Try a shorter search.' : 'Add a page or a file on the Capture screen first.'}
            className="!py-6"
          />
        )}

        {sites.map((site) => {
          const on = pinned.some((p) => p.url === site.url);
          const kind = sourceKind(site.url);
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => toggle({ url: site.url, title: site.title || hostname(site.url) })}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition',
                on
                  ? 'bg-primary-50 ring-1 ring-inset ring-primary-200 dark:bg-primary-500/15 dark:ring-primary-500/30'
                  : 'hover:bg-gray-50 dark:hover:bg-white/5',
              )}
            >
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', SOURCE_ACCENT[kind])}>
                <FileText className="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-gray-800 dark:text-gray-100">
                  {site.title || hostname(site.url)}
                </span>
                <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {prettyUrl(site.url, 52)}
                </span>
              </span>
              {on ? (
                <Pin className="h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-400" />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- the tray -------------------------------- */

export function PinnedTray() {
  const { pinned, remove, clear } = usePinned();
  const [picking, setPicking] = useState(false);

  return (
    <div className="relative">
      {picking && <SourcePicker onClose={() => setPicking(false)} />}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-semibold transition',
            pinned.length
              ? 'border-primary-300 text-primary-600 hover:bg-primary-50 dark:border-primary-500/40 dark:text-primary-400 dark:hover:bg-primary-500/10'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-white/15 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          <Pin className="h-3 w-3" />
          {pinned.length ? `Focused on ${pinned.length}` : 'Pin sources'}
        </button>

        {pinned.map((p) => (
          <span
            key={p.url}
            title={p.url}
            className="flex max-w-[13rem] items-center gap-1 rounded-full bg-primary-50 py-1 pl-2.5 pr-1 text-[11px] font-medium text-primary-700 ring-1 ring-inset ring-primary-200 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/30"
          >
            <span className="truncate">{p.title || hostname(p.url)}</span>
            <button
              type="button"
              onClick={() => remove(p.url)}
              aria-label={`Unpin ${p.title || p.url}`}
              className="rounded-full p-0.5 transition hover:bg-primary-200/70 dark:hover:bg-primary-500/30"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {pinned.length > 1 && (
          <Button variant="ghost" size="sm" onClick={clear} className="!px-2 !text-[11px]">
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

/** Full-width source cards, used by the right rail on wide screens. */
export function SourceGrid({ blocks }: { blocks: RetrievedBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-2">
      {blocks.map((b) => (
        <SourcePreview key={b.id} id={b.id} block={b} />
      ))}
    </div>
  );
}
