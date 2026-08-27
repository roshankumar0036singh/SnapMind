'use client';

/**
 * Notebook — the two things you saved by hand.
 *
 * `bookmarks` and `saved_pages` are separate tables with separate guarantees, so
 * they are separate tabs rather than one merged feed (see `notebook/cards.tsx`
 * for why conflating them would lie to the reader).
 *
 * Three things about this page are shaped by what the backend actually offers,
 * not by preference:
 *
 *  1. **Search is local.** There is no `GET bookmarks?q=` — the only semantic
 *     path into these notes is chat with `query_notebook: true`, which pulls up
 *     to four nearest notes into an answer (search_service.py:280). So the box
 *     here filters literally, and "Ask across your notes" hands the real
 *     retrieval to chat. Two different jobs, named differently on purpose.
 *  2. **Scope is a real switch, not a filter.** `GET bookmarks` and
 *     `GET bookmarks/{workspace_id}` are different routes; likewise saved pages.
 *     Filtering client-side is impossible because neither response carries a
 *     `workspace_id` column.
 *  3. **Page deletion needs the workspace.** `DELETE saved-pages/{id}` matches on
 *     a `workspace_id` query param that the list route never returns
 *     (saved_pages.py:127). In workspace scope we know it; in "Everything" we do
 *     not, so the button says why instead of failing.
 */

import { NoteCard, SavedPageCard } from '@/components/dashboard/notebook/cards';
import {
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorNote,
  FIELD,
  PageHeader,
  Panel,
  Pill,
  SearchInput,
  Segmented,
  Select,
  Skeleton,
} from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { useSettings } from '@/context/SettingsContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import { dayKey, dayLabel, truncate } from '@/lib/format';
import type { Bookmark, SavedPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  BookMarked,
  Bookmark as BookmarkIcon,
  Compass,
  FolderOpen,
  MessageSquareQuote,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

/* --------------------------------- options -------------------------------- */

type Tab = 'notes' | 'pages';
type Scope = 'workspace' | 'all';
type NoteSort = 'newest' | 'oldest' | 'longest';
type PageSort = 'newest' | 'oldest' | 'az';

const NOTE_SORTS: { value: NoteSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'longest', label: 'Longest first' },
];

const PAGE_SORTS: { value: PageSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'A → Z' },
];

/** How many notes a cross-reference question carries, and how much of each. */
const XREF_MAX_NOTES = 8;
const XREF_MAX_CHARS = 240;

/* ---------------------------------- page ---------------------------------- */

export default function NotebookPage() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { setRetrieval } = useSettings();
  const { ingestUrl } = useCapture();

  const [tab, setTab] = useState<Tab>('notes');
  const [scope, setScope] = useState<Scope>('all');
  const [q, setQ] = useState('');
  const [noteSort, setNoteSort] = useState<NoteSort>('newest');
  const [pageSort, setPageSort] = useState<PageSort>('newest');
  const [folder, setFolder] = useState<string | null>(null);
  const [keyword, setKeyword] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [composeOpen, setComposeOpen] = useState(false);
  const [pendingNotes, setPendingNotes] = useState<Bookmark[] | null>(null);
  const [pendingPage, setPendingPage] = useState<SavedPage | null>(null);
  const [deleting, setDeleting] = useState(false);

  /**
   * Scope only means something once a workspace is active, and the route it
   * picks is part of the fetch key — so both loaders depend on it.
   */
  const wsId = activeWorkspace?.id;
  const scoped = scope === 'workspace' && !!wsId;
  const suffix = scoped ? `/${wsId}` : '';

  const notes = useApi<{ bookmarks?: Bookmark[] }>(
    (signal) => api.get(`bookmarks${suffix}`, { signal }),
    [suffix],
  );
  const pages = useApi<{ success?: boolean; data?: SavedPage[] }>(
    (signal) => api.get(`saved-pages${suffix}`, { signal }),
    [suffix],
  );

  const allNotes = notes.data?.bookmarks ?? [];
  const allPages = pages.data?.data ?? [];

  /* ------------------------------- filtering ------------------------------ */

  const needle = q.trim().toLowerCase();

  const visibleNotes = useMemo(() => {
    let rows = allNotes;
    if (needle) {
      rows = rows.filter(
        (n) =>
          n.content?.toLowerCase().includes(needle) ||
          n.source_url?.toLowerCase().includes(needle),
      );
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (noteSort === 'longest') return (b.content?.length ?? 0) - (a.content?.length ?? 0);
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return noteSort === 'oldest' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [allNotes, needle, noteSort]);

  const visiblePages = useMemo(() => {
    let rows = allPages;
    if (needle) {
      rows = rows.filter(
        (p) =>
          p.title?.toLowerCase().includes(needle) ||
          p.summary?.toLowerCase().includes(needle) ||
          p.original_url?.toLowerCase().includes(needle) ||
          (p.keywords ?? []).some((k) => k?.toLowerCase().includes(needle)),
      );
    }
    if (folder) rows = rows.filter((p) => p.folder_name === folder);
    if (keyword) rows = rows.filter((p) => (p.keywords ?? []).includes(keyword));

    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (pageSort === 'az') {
        return (a.title || a.original_url || '').localeCompare(b.title || b.original_url || '');
      }
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return pageSort === 'oldest' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [allPages, needle, folder, keyword, pageSort]);

  /**
   * Facets are counted over everything, not over the filtered set — a facet that
   * vanishes the moment you use it is a worse control than one showing a zero.
   */
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPages) {
      const f = p.folder_name?.trim();
      if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allPages]);

  const keywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPages) {
      for (const k of p.keywords ?? []) {
        const t = k?.trim();
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 14);
  }, [allPages]);

  /* -------------------------------- actions ------------------------------- */

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = visibleNotes.filter((n) => selected.has(n.id));

  /**
   * Cross-reference: the notes go into the question, and `queryNotebook` is
   * switched on so the answer can also pull in *neighbouring* notes the
   * selection missed. Without the toggle this would be a plain summarise; with
   * it, it is genuinely a read across the notebook.
   */
  const crossReference = () => {
    if (chosen.length === 0) return;
    const used = chosen.slice(0, XREF_MAX_NOTES);
    const lines = used.map((n, i) => {
      const src = n.source_url ? ` — ${n.source_url}` : '';
      const body = truncate((n.content ?? '').replace(/\s+/g, ' ').trim(), XREF_MAX_CHARS);
      return `${i + 1}. "${body}"${src}`;
    });
    const ask = [
      `Cross-reference these ${used.length} notes from my notebook. Where do they agree, where do they contradict each other, and what conclusion do they support together? Cite the sources you use.`,
      '',
      ...lines,
    ].join('\n');

    setRetrieval({ queryNotebook: true });
    if (chosen.length > used.length) {
      toast.info(`Using the first ${used.length} of ${chosen.length} notes`);
    }
    router.push(`/text-generator?ask=${encodeURIComponent(ask)}`);
  };

  const askAcross = () => {
    setRetrieval({ queryNotebook: true });
    toast.success('Notebook search is on — ask away');
    router.push('/text-generator');
  };

  const deleteNotes = async () => {
    if (!pendingNotes) return;
    setDeleting(true);
    const ids = new Set(pendingNotes.map((n) => n.id));
    try {
      const results = await Promise.allSettled(
        pendingNotes.map((n) => api.del(`bookmarks/${n.id}`)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      notes.setData({ bookmarks: allNotes.filter((n) => !ids.has(n.id)) });
      setSelected(new Set());
      setPendingNotes(null);
      if (failed > 0) {
        toast.error(`${failed} of ${ids.size} could not be deleted`);
        notes.reload();
      } else {
        toast.success(ids.size === 1 ? 'Note deleted' : `${ids.size} notes deleted`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  const deletePage = async () => {
    if (!pendingPage || !wsId) return;
    setDeleting(true);
    try {
      await api.del(`saved-pages/${pendingPage.id}`, { query: { workspace_id: wsId } });
      pages.setData({ data: allPages.filter((p) => p.id !== pendingPage.id) });
      setPendingPage(null);
      toast.success('Page removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove this page');
    } finally {
      setDeleting(false);
    }
  };

  const indexPage = async (page: SavedPage) => {
    const ok = await ingestUrl({ url: page.original_url });
    if (ok) toast.success('Indexing started — it will show up in your library');
  };

  const loading = tab === 'notes' ? notes.loading : pages.loading;
  const error = tab === 'notes' ? notes.error : pages.error;
  const filtering = !!needle || (tab === 'pages' && (!!folder || !!keyword));

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<BookMarked className="h-6 w-6" />}
          accent="text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400"
          title="Notebook"
          description="Snippets you saved and pages you kept for later. Notes are embedded the moment they land, so chat can recall them; saved pages are a reading list until you index one."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={askAcross}>
                <Sparkles className="h-3.5 w-3.5" />
                Ask across your notes
              </Button>
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add a note
              </Button>
            </div>
          }
        />

        {/* Controls */}
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<Tab>
              value={tab}
              onChange={(v) => {
                setTab(v);
                setQ('');
              }}
              options={[
                {
                  value: 'notes',
                  label: notes.data ? `Notes (${allNotes.length})` : 'Notes',
                  icon: <MessageSquareQuote className="h-3.5 w-3.5" />,
                },
                {
                  value: 'pages',
                  label: pages.data ? `Saved pages (${allPages.length})` : 'Saved pages',
                  icon: <BookmarkIcon className="h-3.5 w-3.5" />,
                },
              ]}
            />

            {activeWorkspace && (
              <Segmented<Scope>
                value={scope}
                onChange={(v) => {
                  setScope(v);
                  setSelected(new Set());
                }}
                options={[
                  { value: 'all', label: 'Everything' },
                  { value: 'workspace', label: activeWorkspace.name },
                ]}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder={tab === 'notes' ? 'Find a phrase in your notes…' : 'Find a saved page…'}
              className="min-w-[15rem] flex-1"
            />
            {tab === 'notes' ? (
              <Select<NoteSort>
                label="Sort notes"
                value={noteSort}
                onChange={setNoteSort}
                options={NOTE_SORTS}
                className="w-auto"
              />
            ) : (
              <Select<PageSort>
                label="Sort pages"
                value={pageSort}
                onChange={setPageSort}
                options={PAGE_SORTS}
                className="w-auto"
              />
            )}
          </div>

          {/* The literal-match caveat, said once and where it matters. */}
          {tab === 'notes' && (
            <p className="text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
              This box matches text exactly. For meaning — “what did I save about pricing?” — use{' '}
              <button
                type="button"
                onClick={askAcross}
                className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 transition hover:text-primary-700 dark:text-primary-400"
              >
                Ask across your notes
              </button>
              , which searches by embedding instead.
            </p>
          )}

          {tab === 'pages' && (folders.length > 0 || keywords.length > 0) && (
            <div className="space-y-2.5 border-t border-gray-100 pt-3.5 dark:border-white/10">
              {folders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    <FolderOpen className="h-3 w-3" />
                    Folders
                  </span>
                  {folders.map(([f, n]) => (
                    <Pill
                      key={f}
                      tone={folder === f ? 'brand' : 'neutral'}
                      active={folder === f}
                      onClick={() => setFolder(folder === f ? null : f)}
                    >
                      {f} · {n}
                    </Pill>
                  ))}
                </div>
              )}
              {keywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Keywords
                  </span>
                  {keywords.map(([k, n]) => (
                    <Pill
                      key={k}
                      tone={keyword === k ? 'brand' : 'neutral'}
                      active={keyword === k}
                      onClick={() => setKeyword(keyword === k ? null : k)}
                    >
                      {k} · {n}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Selection bar — mirrors Library, so the gesture is the same everywhere. */}
        {tab === 'notes' && (
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
            {selected.size > 0 ? (
              <>
                <span className="text-sm font-medium text-gray-900 dark:text-white/90">
                  {selected.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={crossReference}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Cross-reference
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setPendingNotes(chosen)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete selected
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {notes.loading ? (
                  <Skeleton className="h-4 w-44" />
                ) : (
                  <>
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {filtering ? `${visibleNotes.length} of ${allNotes.length}` : allNotes.length}
                    </span>{' '}
                    {allNotes.length === 1 ? 'note' : 'notes'}
                    {scoped && <> in {activeWorkspace?.name}</>}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {tab === 'pages' && !pages.loading && (
          <p className="min-h-9 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white/90">
              {filtering ? `${visiblePages.length} of ${allPages.length}` : allPages.length}
            </span>{' '}
            {allPages.length === 1 ? 'page' : 'pages'}
            {scoped && <> in {activeWorkspace?.name}</>}
          </p>
        )}

        {/* Body */}
        {error ? (
          <ErrorNote message={error} onRetry={tab === 'notes' ? notes.reload : pages.reload} />
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-3xl" />
            ))}
          </div>
        ) : tab === 'notes' ? (
          visibleNotes.length === 0 ? (
            <Panel>
              {allNotes.length === 0 ? (
                <EmptyState
                  icon={<NotebookPen className="h-7 w-7" />}
                  title="No notes yet"
                  description="Notes come from “Save to notebook” under a research answer, from the bookmark icon on a citation in the extension, or from the button below. Each one is embedded as it lands, so chat can quote it back to you."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button onClick={() => setComposeOpen(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        Write your first note
                      </Button>
                      <Button variant="outline" onClick={() => router.push('/research')}>
                        <Compass className="h-3.5 w-3.5" />
                        Go research something
                      </Button>
                    </div>
                  }
                />
              ) : (
                <EmptyState
                  icon={<NotebookPen className="h-7 w-7" />}
                  title="Nothing matches that"
                  description="No note contains that text. Semantic recall lives in chat, not here."
                  action={
                    <Button variant="outline" onClick={() => setQ('')}>
                      Clear the search
                    </Button>
                  }
                />
              )}
            </Panel>
          ) : (
            <GroupedNotes
              notes={visibleNotes}
              grouped={noteSort !== 'longest'}
              selected={selected}
              onToggle={toggle}
              onDelete={(n) => setPendingNotes([n])}
            />
          )
        ) : visiblePages.length === 0 ? (
          <Panel>
            {allPages.length === 0 ? (
              <EmptyState
                icon={<BookmarkIcon className="h-7 w-7" />}
                title="No saved pages"
                description="Use “Save this page” in the extension while you are reading. SnapMind keeps the title, a summary and its keywords — not the page text — so index a page here when you want to ask questions about it."
                action={
                  <Button variant="outline" onClick={() => router.push('/capture')}>
                    Capture a page instead
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<BookmarkIcon className="h-7 w-7" />}
                title="Nothing matches those filters"
                description="Try clearing the folder or keyword you picked."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQ('');
                      setFolder(null);
                      setKeyword(null);
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePages.map((p) => (
              <SavedPageCard
                key={p.id}
                page={p}
                onIndex={() => void indexPage(p)}
                onDelete={() => setPendingPage(p)}
                deleteHint={
                  scoped
                    ? undefined
                    : activeWorkspace
                      ? `Switch to ${activeWorkspace.name} to remove this — the delete route needs the page's workspace`
                      : 'Removing a saved page needs an active workspace'
                }
              />
            ))}
          </div>
        )}
      </div>

      <ComposeNote
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        workspaceId={wsId}
        onSaved={(note) => notes.setData({ bookmarks: [note, ...allNotes] })}
      />

      <ConfirmDialog
        open={pendingNotes !== null}
        onClose={() => setPendingNotes(null)}
        onConfirm={() => void deleteNotes()}
        loading={deleting}
        title={
          pendingNotes && pendingNotes.length > 1
            ? `Delete ${pendingNotes.length} notes?`
            : 'Delete this note?'
        }
        description="The note and its embedding are removed, so chat stops recalling it. This cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      />

      <ConfirmDialog
        open={pendingPage !== null}
        onClose={() => setPendingPage(null)}
        onConfirm={() => void deletePage()}
        loading={deleting}
        title="Remove this page?"
        description="It leaves your reading list. Anything already indexed from it stays in your library."
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
      />
    </div>
  );
}

/* ------------------------------ note grouping ----------------------------- */

/**
 * Day headings, but only for the chronological sorts — grouping a longest-first
 * list by date would emit headings in an arbitrary order.
 */
function GroupedNotes({
  notes,
  grouped,
  selected,
  onToggle,
  onDelete,
}: {
  notes: Bookmark[];
  grouped: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (n: Bookmark) => void;
}) {
  const groups = useMemo(() => {
    if (!grouped) return [{ key: 'all', label: '', rows: notes }];
    const out: { key: string; label: string; rows: Bookmark[] }[] = [];
    for (const n of notes) {
      const key = dayKey(n.created_at) || 'undated';
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(n);
      else out.push({ key, label: n.created_at ? dayLabel(n.created_at) : 'Undated', rows: [n] });
    }
    return out;
  }, [notes, grouped]);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          {g.label && (
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {g.label}
              </h2>
              <span className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
              <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {g.rows.length}
              </span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {g.rows.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                selected={selected.has(n.id)}
                onToggle={() => onToggle(n.id)}
                onDelete={() => onDelete(n)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------- compose note ----------------------------- */

/**
 * `POST bookmarks` embeds the text before it stores it, so this can fail for a
 * reason that has nothing to do with the note: no Gemini or Mistral key
 * (bookmarks.py:36 returns a 500 in that case). The server's message is
 * surfaced verbatim rather than replaced with "could not save".
 */
function ComposeNote({
  open,
  onClose,
  workspaceId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
  onSaved: (note: Bookmark) => void;
}) {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const text = content.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await api.post<{ id?: string }>('bookmarks', {
        content: text,
        source_url: url.trim() || null,
        workspace_id: workspaceId ?? null,
        metadata: { origin: 'web' },
      });
      onSaved({
        id: res.id ?? `pending-${text.length}-${text.slice(0, 8)}`,
        content: text,
        source_url: url.trim() || null,
        metadata: { origin: 'web' },
        created_at: new Date().toISOString(),
      });
      toast.success('Saved to your notebook');
      setContent('');
      setUrl('');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save this note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add a note"
      subtitle="Anything you write here is embedded, so chat can find it later"
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!content.trim()}>
            Save note
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
            The note
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            autoFocus
            placeholder="Paste a quote, or write the thought you want to keep…"
            className={cn(FIELD, 'resize-y leading-relaxed')}
          />
          <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
            {content.trim().length} characters
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
            Where it came from{' '}
            <span className="font-normal text-gray-400 dark:text-gray-500">optional</span>
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={FIELD}
          />
        </label>

        <p className="rounded-2xl bg-gray-50 px-3.5 py-3 text-[11.5px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          Saving embeds the text, which needs a Gemini or Mistral key in Settings. A note is not the
          same as an indexed source — it is one snippet chat can recall, not a document it can search
          through.
        </p>
      </div>
    </Drawer>
  );
}
