'use client';

import { SourceDrawer } from '@/components/dashboard/library/source-drawer';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  IconBadge,
  Panel,
  PageHeader,
  Pill,
  SearchInput,
  Select,
  Skeleton,
} from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import {
  SOURCE_ACCENT,
  SOURCE_LABELS,
  compactNumber,
  hostname,
  prettyUrl,
  relativeTime,
  sourceKind,
} from '@/lib/format';
import type { Site, SourceKind } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Languages,
  Library as LibraryIcon,
  MessageCircle,
  Plus,
  Search,
  Tag,
  Trash2,
  Type,
  Video,
} from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

/* ------------------------------- presentation ------------------------------ */

const KIND_ICON: Record<SourceKind, React.ReactNode> = {
  web: <Globe className="w-4 h-4" />,
  youtube: <Video className="w-4 h-4" />,
  twitter: <MessageCircle className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
  docx: <FileText className="w-4 h-4" />,
  csv: <FileSpreadsheet className="w-4 h-4" />,
  github: <GitBranch className="w-4 h-4" />,
  text: <Type className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
};

type SortKey = 'recent' | 'oldest' | 'largest' | 'az';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'largest', label: 'Most chunks' },
  { value: 'az', label: 'A → Z' },
];

/* ---------------------------------- page ---------------------------------- */

export default function LibraryPage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryContent />
    </Suspense>
  );
}

function LibraryContent() {
  const params = useSearchParams();
  const { openQuick } = useCapture();

  const sites = useApi<{ sites: Site[] }>((signal) => api.get('sites', { signal }), []);

  const [q, setQ] = useState('');
  const [kind, setKind] = useState<SourceKind | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Site[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const all = sites.data?.sites ?? [];

  // Deep links from the Overview page and the extension: ?tag= / ?source=
  useEffect(() => {
    const t = params.get('tag');
    if (t) setTag(t);
    const s = params.get('source');
    if (s) setOpenUrl(s);
  }, [params]);

  const kindCounts = useMemo(() => {
    const m = new Map<SourceKind, number>();
    for (const s of all) {
      const k = sourceKind(s.url);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [all]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of all) for (const t of s.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = all.filter((s) => {
      if (kind !== 'all' && sourceKind(s.url) !== kind) return false;
      if (tag && !(s.tags ?? []).includes(tag)) return false;
      if (!needle) return true;
      return (
        s.url.toLowerCase().includes(needle) ||
        (s.title ?? '').toLowerCase().includes(needle) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(needle))
      );
    });

    const time = (s: Site) => new Date(s.last_updated_at).getTime() || 0;
    out.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return time(a) - time(b);
        case 'largest':
          return (b.chunk_count ?? 0) - (a.chunk_count ?? 0);
        case 'az':
          return prettyUrl(a.url).localeCompare(prettyUrl(b.url));
        default:
          return time(b) - time(a);
      }
    });
    return out;
  }, [all, q, kind, tag, sort]);

  const openSite = openUrl ? (all.find((s) => s.url === openUrl) ?? null) : null;
  const totalChunks = all.reduce((n, s) => n + (s.chunk_count ?? 0), 0);
  const filtering = q.trim() !== '' || kind !== 'all' || tag !== null;

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.url));

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      if (filtered.every((s) => prev.has(s.url))) {
        const next = new Set(prev);
        for (const s of filtered) next.delete(s.url);
        return next;
      }
      return new Set([...prev, ...filtered.map((s) => s.url)]);
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const targets = pendingDelete;
    const failures: string[] = [];

    for (const s of targets) {
      try {
        await api.del(`sites/${encodeURIComponent(s.url)}`);
      } catch (err) {
        failures.push((err as Error).message);
      }
    }

    // Optimistic removal for everything that actually went through.
    const removed = new Set(targets.map((s) => s.url));
    const kept = failures.length === targets.length ? all : all.filter((s) => !removed.has(s.url));
    sites.setData({ sites: kept });
    setSelected(new Set());
    setPendingDelete(null);
    setOpenUrl((u) => (u && removed.has(u) ? null : u));
    setDeleting(false);

    if (failures.length) {
      toast.error(
        failures.length === targets.length ? 'Delete failed' : `${failures.length} could not be deleted`,
        { description: failures[0] },
      );
      sites.reload();
    } else {
      toast.success(targets.length === 1 ? 'Source deleted' : `${targets.length} sources deleted`);
    }
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-6">
        <PageHeader
          icon={<LibraryIcon className="w-6 h-6" />}
          title="Library"
          description="Everything SnapMind has indexed. Inspect the chunks it stored, re-index, export, or clear it out."
          accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
          actions={
            <Button variant="gradient" size="sm" onClick={openQuick}>
              <Plus className="w-4 h-4" />
              Add source
            </Button>
          }
        />

        {sites.error && <ErrorNote message={sites.error} onRetry={sites.reload} />}

        {/* Filters */}
        <Panel className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by URL, title or tag"
              className="flex-1"
            />
            <Select
              value={sort}
              onChange={setSort}
              options={SORTS}
              label="Sort sources"
              className="sm:w-44"
            />
          </div>

          {/* Source-kind facets — only kinds actually present */}
          {kindCounts.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={kind === 'all' ? 'brand' : 'neutral'} onClick={() => setKind('all')}>
                All
                <span className="opacity-60">{all.length}</span>
              </Pill>
              {[...kindCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <Pill
                    key={k}
                    tone={kind === k ? 'brand' : 'neutral'}
                    onClick={() => setKind(kind === k ? 'all' : k)}
                  >
                    {SOURCE_LABELS[k]}
                    <span className="opacity-60">{n}</span>
                  </Pill>
                ))}
            </div>
          )}

          {/* Tags */}
          {tagCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-white/5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 mr-1 mt-3">
                <Tag className="w-3 h-3" />
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tagCounts.slice(0, 24).map(([t, n]) => (
                  <Pill
                    key={t}
                    tone={tag === t ? 'brand' : 'neutral'}
                    onClick={() => setTag(tag === t ? null : t)}
                  >
                    {t}
                    <span className="opacity-60">{n}</span>
                  </Pill>
                ))}
                {tag && !tagCounts.some(([t]) => t === tag) && (
                  <Pill tone="brand" onClick={() => setTag(null)}>
                    {tag} ✕
                  </Pill>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* Summary / bulk bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 min-h-9">
          {selected.size > 0 ? (
            <>
              <span className="text-sm font-medium text-gray-900 dark:text-white/90">
                {selected.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPendingDelete(all.filter((s) => selected.has(s.url)))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete selected
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sites.loading ? (
                  <Skeleton className="h-4 w-48" />
                ) : (
                  <>
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {filtering ? `${filtered.length} of ${all.length}` : all.length}
                    </span>{' '}
                    {all.length === 1 ? 'source' : 'sources'}
                    {totalChunks > 0 && (
                      <>
                        {' · '}
                        <span className="font-medium text-gray-900 dark:text-white/90">
                          {compactNumber(totalChunks)}
                        </span>{' '}
                        chunks
                      </>
                    )}
                  </>
                )}
              </p>
              {filtering && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQ('');
                    setKind('all');
                    setTag(null);
                  }}
                >
                  Reset filters
                </Button>
              )}
            </>
          )}
        </div>

        {/* Table */}
        {sites.loading ? (
          <Panel className="p-0 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <Skeleton className="h-4 flex-1 max-w-sm" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </Panel>
        ) : all.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Database className="w-7 h-7" />}
              title="Your library is empty"
              description="Index a web page, PDF, YouTube video, spreadsheet or repository and it becomes searchable within seconds."
              action={
                <Button variant="gradient" onClick={openQuick}>
                  <Plus className="w-4 h-4" />
                  Add your first source
                </Button>
              }
            />
          </Panel>
        ) : filtered.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Search className="w-7 h-7" />}
              title="No sources match"
              description="Try a different search term, or clear the type and tag filters."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ('');
                    setKind('all');
                    setTag(null);
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </Panel>
        ) : (
          <Panel padded={false} className="overflow-hidden">
            {/* Column head — hidden on small screens where rows stack. */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Checkbox
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && filtered.some((s) => selected.has(s.url))}
                onChange={toggleAllVisible}
                label="Select all visible sources"
              />
              <span>Source</span>
              <span className="w-24 text-right">Chunks</span>
              <span className="w-28">Indexed</span>
              <span className="w-8 sr-only">Actions</span>
            </div>

            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {filtered.map((s) => {
                const k = sourceKind(s.url);
                const isSelected = selected.has(s.url);
                return (
                  <li
                    key={s.url}
                    className={cn(
                      'group relative transition-colors',
                      isSelected
                        ? 'bg-primary-50/60 dark:bg-primary-500/[0.07]'
                        : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="md:grid md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center gap-4 px-5 py-4 flex flex-col">
                      <div className="flex items-center gap-4 md:contents">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggle(s.url)}
                          label={`Select ${prettyUrl(s.url, 40)}`}
                        />

                        {/* Source cell — the whole cell opens the drawer. */}
                        <button
                          type="button"
                          onClick={() => setOpenUrl(s.url)}
                          className="flex items-center gap-3.5 min-w-0 text-left flex-1 rounded-xl focus-visible:outline-none focus-visible:shadow-ring"
                        >
                          <IconBadge
                            icon={KIND_ICON[k]}
                            className={cn(SOURCE_ACCENT[k], 'w-9 h-9 rounded-xl')}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-gray-900 dark:text-white/90 truncate">
                              {s.title && s.title !== s.url ? s.title : prettyUrl(s.url, 56)}
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                              <span className="truncate">{hostname(s.url) || SOURCE_LABELS[k]}</span>
                              {s.translated && (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <Languages className="w-3 h-3" />
                                  translated
                                </span>
                              )}
                            </span>
                            {(s.tags?.length ?? 0) > 0 && (
                              <span className="mt-1.5 flex flex-wrap gap-1">
                                {s.tags!.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {s.tags!.length > 3 && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center">
                                    +{s.tags!.length - 3}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4 pl-[2.1rem] md:pl-0 md:contents">
                        <span className="md:w-24 md:text-right text-xs md:text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          {compactNumber(s.chunk_count ?? 0)}
                          <span className="md:hidden"> chunks</span>
                        </span>
                        <span
                          className="md:w-28 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap"
                          title={s.last_updated_at}
                        >
                          {relativeTime(s.last_updated_at)}
                        </span>
                        <span className="flex items-center gap-0.5 md:w-8 md:justify-end">
                          {/^https?:\/\//i.test(s.url) && (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label={`Open ${hostname(s.url)} in a new tab`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-white dark:hover:bg-white/10 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDelete([s])}
                            aria-label={`Delete ${prettyUrl(s.url, 40)}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>

      <SourceDrawer
        site={openSite}
        open={openSite !== null}
        onClose={() => setOpenUrl(null)}
        onDelete={(s) => setPendingDelete([s])}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} sources?`
            : 'Delete this source?'
        }
        description={
          pendingDelete && pendingDelete.length === 1
            ? `Every chunk indexed from ${prettyUrl(pendingDelete[0].url, 60)} is removed. This cannot be undone.`
            : 'Every chunk indexed from these sources is removed. This cannot be undone.'
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      />
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </div>
  );
}
