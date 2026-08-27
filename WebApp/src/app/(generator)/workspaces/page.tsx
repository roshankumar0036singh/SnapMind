'use client';

/**
 * Workspaces.
 *
 * A workspace is the filter every scoped request carries, so this page's job is
 * to make that scoping legible — and to be honest about the four places the
 * backend does less than the word "workspace" implies:
 *
 * 1. **No rename.** `workspaces.py` exposes create, list, read and delete. There
 *    is no update route and no repository method for one, so the name and the
 *    description are fixed at creation. Offering an edit field would be a lie.
 * 2. **Description lives in `metadata`**, which is written once for the same
 *    reason. WorkspaceContext lifts it out so it can at least be displayed.
 * 3. **Delete is a partial delete.** Only `documents`, `pending_embeddings` and
 *    `saved_pages` declare `ON DELETE CASCADE` (sql/supabase_setup.sql). Chats,
 *    notes, graph nodes/edges and ingestion jobs carry a plain `workspace_id`
 *    with no foreign key, so they survive the workspace pointing at nothing. The
 *    confirm dialog says exactly that.
 * 4. **Chat counts need one request each.** `GET chat/sessions` returns
 *    `id, title, updated_at` only (chat.py:187) — no `workspace_id` column — so
 *    they cannot be grouped client-side. The route does accept a `workspace_id`
 *    filter, so counts come from one small request per workspace, in parallel.
 *
 * Source counts come from `GET sites`, which does return `workspace_id`. Its rows
 * are grouped by `source_url` with `MAX(workspace_id)` (sites.py:18), so a source
 * ingested into two workspaces is attributed to one of them.
 */

import {
  Button,
  ConfirmDialog,
  Drawer,
  ErrorNote,
  IconBadge,
  INSET,
  PageHeader,
  Panel,
  Pill,
  SectionHeader,
  Select,
  Skeleton,
} from '@/components/dashboard/ui';
import { OUTPUT_LANGUAGES, useSettings } from '@/context/SettingsContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import { compactNumber } from '@/lib/format';
import type { ChatSession, Persona, Site, Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  Database,
  FileStack,
  FolderOpen,
  FolderSync,
  Layers,
  MessageSquare,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const INHERIT = '__inherit__';

/** Date only — `absoluteTime` adds a clock, which a card footer doesn't need. */
function shortDate(input?: string | null): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type Counts = { sources: number; chunks: number; chats: number };

export default function WorkspacesPage() {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    isLoading,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspace();

  const [creating, setCreating] = useState(false);
  const [tuning, setTuning] = useState<Workspace | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sites = useApi<{ success?: boolean; sites?: Site[] }>(
    (signal) => api.get('sites', { signal }),
    [],
  );

  const wsKey = workspaces.map((w) => w.id).join(',');

  /** One request per workspace — see the note at the top of the file. */
  const chatCounts = useApi<Record<string, number>>(
    async (signal) => {
      const ids = workspaces.map((w) => w.id);
      const rows = await Promise.all(
        ids.map((id) =>
          api
            .get<ChatSession[]>('chat/sessions', { query: { workspace_id: id }, signal })
            .catch(() => [] as ChatSession[]),
        ),
      );
      return Object.fromEntries(
        ids.map((id, i) => [id, Array.isArray(rows[i]) ? rows[i].length : 0]),
      );
    },
    wsKey ? [wsKey] : null,
  );

  const allChats = useApi<ChatSession[]>((signal) => api.get('chat/sessions', { signal }), []);

  const allSites = useMemo(() => sites.data?.sites ?? [], [sites.data]);

  const counts = useMemo(() => {
    const map = new Map<string, Counts>();
    for (const site of allSites) {
      const key = site.workspace_id ?? '__none__';
      const row = map.get(key) ?? { sources: 0, chunks: 0, chats: 0 };
      row.sources += 1;
      row.chunks += site.chunk_count ?? 0;
      map.set(key, row);
    }
    for (const [id, n] of Object.entries(chatCounts.data ?? {})) {
      const row = map.get(id) ?? { sources: 0, chunks: 0, chats: 0 };
      row.chats = n;
      map.set(id, row);
    }
    return map;
  }, [allSites, chatCounts.data]);

  /**
   * Chats the filtered queries never return: `workspace_id = %s` excludes NULLs,
   * so the shortfall against the unfiltered list is the unassigned set.
   */
  const orphanChats = useMemo(() => {
    if (!Array.isArray(allChats.data) || !chatCounts.data) return 0;
    const assigned = Object.values(chatCounts.data).reduce((a, b) => a + b, 0);
    return Math.max(0, allChats.data.length - assigned);
  }, [allChats.data, chatCounts.data]);

  const unassigned = counts.get('__none__');
  const hasUnassigned = (unassigned?.sources ?? 0) > 0 || orphanChats > 0;

  // Newest first, and deliberately not "active first" — cards that reshuffle when
  // you switch workspaces make the grid impossible to keep your place in.
  const ordered = useMemo(
    () =>
      [...workspaces].sort((a, b) => {
        const at = a.created_at ? Date.parse(a.created_at) : NaN;
        const bt = b.created_at ? Date.parse(b.created_at) : NaN;
        if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
        return a.name.localeCompare(b.name);
      }),
    [workspaces],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteWorkspace(pendingDelete.id);
      toast.success(`Deleted ${pendingDelete.name}`);
      setPendingDelete(null);
      void sites.reload();
      void allChats.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the workspace');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-50/60 dark:bg-dark-secondary">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <PageHeader
          icon={<Layers className="h-6 w-6" />}
          title="Workspaces"
          description="Every capture, question and note is filed under one workspace. Switching here changes what the rest of the dashboard can see."
          actions={
            <Button variant="gradient" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New workspace
            </Button>
          }
        />

        {sites.error && <ErrorNote message={sites.error} onRetry={sites.reload} />}

        {isLoading && workspaces.length === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Panel key={i} className="space-y-4">
                <Skeleton className="h-10 w-10 rounded-2xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </Panel>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {ordered.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                active={activeWorkspace?.id === ws.id}
                counts={counts.get(ws.id)}
                countsLoading={sites.loading || chatCounts.loading}
                onlyOne={workspaces.length <= 1}
                onUse={() => {
                  setActiveWorkspace(ws);
                  toast.success(`Now working in ${ws.name}`);
                }}
                onTune={() => setTuning(ws)}
                onDelete={() => setPendingDelete(ws)}
              />
            ))}

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gray-200 p-8 text-center transition hover:border-primary-300 hover:bg-white focus-visible:shadow-ring focus-visible:outline-none dark:border-white/10 dark:hover:border-primary-500/40 dark:hover:bg-white/[0.03]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                New workspace
              </span>
              <span className="max-w-[16rem] text-xs text-gray-500 dark:text-gray-400">
                Keep a client, a course or a project's sources apart from everything else
              </span>
            </button>
          </div>
        )}

        {hasUnassigned && (
          <Panel>
            <SectionHeader
              title="Not in any workspace"
              description="Captured before workspaces existed, or by a client that didn't send one."
            />
            <div className="flex flex-wrap items-center gap-2">
              {(unassigned?.sources ?? 0) > 0 && (
                <Pill tone="neutral">
                  <FileStack className="h-3 w-3" />
                  {compactNumber(unassigned?.sources)} sources
                </Pill>
              )}
              {(unassigned?.chunks ?? 0) > 0 && (
                <Pill tone="neutral">
                  <Database className="h-3 w-3" />
                  {compactNumber(unassigned?.chunks)} chunks
                </Pill>
              )}
              {orphanChats > 0 && (
                <Pill tone="neutral">
                  <MessageSquare className="h-3 w-3" />
                  {compactNumber(orphanChats)} chats
                </Pill>
              )}
            </div>
            {/* amber, not a `warning-*` token: globals.css has no warning ramp —
                the Pill primitive's warning tone uses Tailwind's amber too. */}
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <p className="text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
                Chat can&apos;t reach these while a workspace is active. Retrieval adds
                <code className="mx-1 rounded bg-white/60 px-1 py-0.5 text-[11px] dark:bg-black/20">
                  workspace_id = …
                </code>
                to its filter, and these rows have no workspace — so they only surface if a request
                carries no workspace at all. Re-capture them from{' '}
                <a
                  href="/capture"
                  className="font-medium underline decoration-amber-400/60 underline-offset-2"
                >
                  Capture
                </a>{' '}
                with a workspace selected to make them searchable.
              </p>
            </div>
          </Panel>
        )}
      </div>

      <CreateWorkspaceDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={createWorkspace}
      />

      <DefaultsDrawer workspace={tuning} onClose={() => setTuning(null)} />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : 'Delete workspace?'}
        description={
          'Its indexed documents, anything still queued for embedding, and its saved pages are deleted with it. ' +
          'Chats, notebook notes, graph entities and capture history are not — those tables have no foreign key to the workspace, so they stay in your account with a workspace that no longer exists. This cannot be undone.'
        }
        confirmLabel="Delete workspace"
        tone="danger"
        loading={deleting}
      />
    </div>
  );
}

/* ---------------------------------- card ---------------------------------- */

function WorkspaceCard({
  workspace,
  active,
  counts,
  countsLoading,
  onlyOne,
  onUse,
  onTune,
  onDelete,
}: {
  workspace: Workspace;
  active: boolean;
  counts?: Counts;
  countsLoading: boolean;
  onlyOne: boolean;
  onUse: () => void;
  onTune: () => void;
  onDelete: () => void;
}) {
  const { workspaceOverrides } = useSettings();
  const overrides = workspaceOverrides[workspace.id];
  const overrideCount = overrides ? Object.keys(overrides).length : 0;
  const created = shortDate(workspace.created_at);

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-theme-xs transition dark:bg-dark-primary',
        active
          ? 'border-primary-300 ring-1 ring-primary-200 dark:border-primary-500/50 dark:ring-primary-500/25'
          : 'border-gray-100 hover:shadow-theme-sm dark:border-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <IconBadge
          icon={active ? <FolderOpen className="h-5 w-5" /> : <FolderSync className="h-5 w-5" />}
          className={
            active
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300'
              : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
          }
        />
        {active && (
          <Pill tone="brand">
            <Check className="h-3 w-3" />
            Active
          </Pill>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white/90">
          {workspace.name}
        </h3>
        {workspace.description ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            {workspace.description}
          </p>
        ) : (
          <p className="mt-1 text-[12.5px] text-gray-400 dark:text-gray-500">No description</p>
        )}
      </div>

      <div className={cn(INSET, 'grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/5')}>
        <Metric label="Sources" value={counts?.sources} loading={countsLoading} />
        <Metric label="Chunks" value={counts?.chunks} loading={countsLoading} />
        <Metric label="Chats" value={counts?.chats} loading={countsLoading} />
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="truncate">{created ? `Created ${created}` : 'Created'}</span>
          {overrideCount > 0 && (
            <span className="shrink-0 font-medium text-primary-600 dark:text-primary-400">
              {overrideCount === 1 ? '1 override' : `${overrideCount} overrides`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
          <Button
            variant={active ? 'outline' : 'soft'}
            size="sm"
            onClick={onUse}
            disabled={active}
            className="flex-1"
          >
            {active ? 'In use' : 'Use this'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onTune}>
            <Settings2 className="h-3.5 w-3.5" />
            Defaults
          </Button>
          <button
            type="button"
            onClick={onDelete}
            disabled={onlyOne}
            title={
              onlyOne
                ? 'This is your only workspace — create another before deleting it, or the app will just make a new default one'
                : `Delete ${workspace.name}`
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-error-50 hover:text-error-600 focus-visible:shadow-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-error-500/10"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete {workspace.name}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white/90">
        {loading && value === undefined ? (
          <Skeleton className="mx-auto h-4 w-8" />
        ) : (
          compactNumber(value ?? 0)
        )}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </div>
    </div>
  );
}

/* --------------------------------- create --------------------------------- */

function CreateWorkspaceDrawer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<Workspace>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setName('');
    setDescription('');
    onClose();
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const created = await onCreate(name, description);
      toast.success(`${created.name} is ready and now active`);
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the workspace');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="New workspace"
      subtitle="It becomes active as soon as it's created."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={submit} loading={busy} disabled={!name.trim()}>
            Create workspace
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="Thesis sources, Client — Acme, CS231n…"
            autoFocus
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary-400 focus:shadow-ring focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Description <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What belongs in here?"
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary-400 focus:shadow-ring focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
          />
        </label>

        {/* Both fields are final: the backend has no update route, and the
            description is stored inside the workspace's write-once metadata. */}
        <p className="rounded-2xl bg-gray-50 px-4 py-3 text-[12px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          Name and description can&apos;t be changed later — the backend has no update route for a
          workspace, only create, read and delete. Pick a name you&apos;ll recognise in the
          switcher.
        </p>
      </div>
    </Drawer>
  );
}

/* -------------------------------- defaults -------------------------------- */

/**
 * Per-workspace answer defaults. Stored in this browser, not on the server —
 * `workspaces.metadata` is write-once, so there is nowhere to put them. The
 * drawer says so rather than implying they follow the account around.
 */
function DefaultsDrawer({
  workspace,
  onClose,
}: {
  workspace: Workspace | null;
  onClose: () => void;
}) {
  const { globalPrefs, workspaceOverrides, setWorkspaceOverride } = useSettings();

  const personas = useApi<{ success?: boolean; personas?: Persona[] }>(
    (signal) => api.get('personas', { signal }),
    workspace ? [workspace.id] : null,
  );

  const overrides = workspace ? (workspaceOverrides[workspace.id] ?? {}) : {};
  const personaList = personas.data?.personas ?? [];

  const globalPersonaName =
    personaList.find((p) => p.id === globalPrefs.personaId)?.name ?? 'None';
  const globalLangName =
    OUTPUT_LANGUAGES.find((l) => l.value === globalPrefs.outputLang)?.label ??
    globalPrefs.outputLang;

  const langOptions = [
    { value: INHERIT, label: `Account default — ${globalLangName}` },
    ...OUTPUT_LANGUAGES.map((l) => ({ value: l.value, label: l.label })),
  ];

  const personaOptions = [
    { value: INHERIT, label: `Account default — ${globalPersonaName}` },
    { value: 'none', label: 'No persona' },
    ...personaList.map((p) => ({ value: p.id, label: p.name })),
  ];

  const langValue = overrides.outputLang ?? INHERIT;
  const personaValue =
    overrides.personaId === undefined ? INHERIT : (overrides.personaId ?? 'none');

  return (
    <Drawer
      open={!!workspace}
      onClose={onClose}
      title={workspace ? `Defaults for ${workspace.name}` : 'Workspace defaults'}
      subtitle="Applied to every answer while this workspace is active."
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (!workspace) return;
              setWorkspaceOverride(workspace.id, null);
              toast.success('Back to your account defaults');
            }}
            disabled={Object.keys(overrides).length === 0}
          >
            Reset to account defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Answer language
          </span>
          <Select
            label="Answer language for this workspace"
            value={langValue}
            options={langOptions}
            onChange={(v) =>
              workspace &&
              setWorkspaceOverride(workspace.id, {
                outputLang: v === INHERIT ? undefined : v,
              })
            }
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sent with every question as the requested output language.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Persona</span>
          <Select
            label="Persona for this workspace"
            value={personaValue}
            options={personaOptions}
            onChange={(v) =>
              workspace &&
              setWorkspaceOverride(workspace.id, {
                personaId: v === INHERIT ? undefined : v === 'none' ? null : v,
              })
            }
          />
          {personas.loading && <Skeleton className="h-3 w-32" />}
          {!personas.loading && personaList.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No personas yet — create one in Settings and it&apos;ll appear here.
            </p>
          )}
        </div>

        <p className="rounded-2xl bg-gray-50 px-4 py-3 text-[12px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          These two live in this browser. A workspace row can only be written once, at creation, so
          the server has nowhere to keep them — they won&apos;t follow you to another device.
          Everything else, including the retrieval toggles, stays global and is set per question in
          the composer.
        </p>
      </div>
    </Drawer>
  );
}
