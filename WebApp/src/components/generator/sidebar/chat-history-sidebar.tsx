'use client';

/**
 * Chat history rail.
 *
 * `GET chat/sessions` returns `{session_id, title, updated_at}` ordered by
 * recency (chat.py:174), so grouping by day here is presentation only — no extra
 * request. Rename/delete hit `PATCH|DELETE chat/sessions/{id}` and are applied
 * optimistically, because the list is navigation: waiting on a round-trip to
 * redraw a title reads as a broken click.
 */

import { ConfirmDialog, EmptyState, IconButton, SearchInput, Spinner } from '@/components/dashboard/ui';
import { useWorkspace } from '@/context/WorkspaceContext';
import { api } from '@/lib/api-client';
import { dayKey, dayLabel, downloadBlob, relativeTime } from '@/lib/format';
import type { ChatSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  Download,
  FileJson,
  FileText,
  MessageSquare,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import NewChat from './new-chat';

/* --------------------------------- row menu -------------------------------- */

function RowMenu({
  onRename,
  onExport,
  onDelete,
}: {
  onRename: () => void;
  onExport: (format: 'markdown' | 'json') => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-gray-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5';

  return (
    <div ref={ref} className="relative shrink-0">
      <IconButton
        label="More actions"
        icon={<MoreHorizontal className="h-3.5 w-3.5" />}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100',
          open && 'opacity-100',
        )}
      />

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-40 mt-1 w-44 rounded-2xl border border-gray-100 bg-white p-1 shadow-theme-lg dark:border-white/10 dark:bg-dark-primary"
        >
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onExport('markdown');
            }}
          >
            <FileText className="h-3.5 w-3.5" /> Export Markdown
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onExport('json');
            }}
          >
            <FileJson className="h-3.5 w-3.5" /> Export JSON
          </button>
          <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
          <button
            type="button"
            className={cn(item, 'text-error-600 hover:bg-error-50 dark:text-red-300 dark:hover:bg-error-500/10')}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------- row ---------------------------------- */

function SessionRow({
  session,
  active,
  onOpen,
  onRename,
  onExport,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onExport: (format: 'markdown' | 'json') => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== session.title) onRename(title);
    else setDraft(session.title ?? '');
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-xl border border-primary-200 bg-white px-2 py-1.5 dark:border-primary-500/40 dark:bg-dark-primary">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(session.title ?? '');
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-800 outline-none dark:text-gray-100"
        />
        <IconButton
          label="Cancel"
          icon={<X className="h-3 w-3" />}
          onClick={() => {
            setDraft(session.title ?? '');
            setEditing(false);
          }}
        />
        <IconButton label="Save title" icon={<Check className="h-3 w-3" />} onClick={commit} />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      title={session.title ?? 'Untitled chat'}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 transition',
        active
          ? 'bg-primary-50 ring-1 ring-inset ring-primary-200 dark:bg-primary-500/15 dark:ring-primary-500/30'
          : 'hover:bg-gray-100 dark:hover:bg-white/5',
      )}
    >
      <MessageSquare
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500',
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13px]',
            active
              ? 'font-semibold text-primary-700 dark:text-primary-300'
              : 'font-medium text-gray-700 dark:text-gray-200',
          )}
        >
          {session.title || 'Untitled chat'}
        </p>
        {session.updated_at && (
          <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">
            {relativeTime(session.updated_at)}
          </p>
        )}
      </div>

      <RowMenu onRename={() => setEditing(true)} onExport={onExport} onDelete={onDelete} />
    </div>
  );
}

/* --------------------------------- sidebar -------------------------------- */

export default function RightSidebar({
  isOpen,
  toggleIsOpen,
}: {
  isOpen: boolean;
  toggleIsOpen: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get('id');
  const { activeWorkspace } = useWorkspace();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.get<ChatSession[] | { sessions?: ChatSession[] }>('chat/sessions', {
        query: { workspace_id: activeWorkspace?.id },
      });
      setSessions(Array.isArray(rows) ? rows : (rows?.sessions ?? []));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // A new chat syncs itself only after its first answer, so re-read the list
  // whenever the active session changes — that is when a new row can appear.
  useEffect(() => {
    if (activeId) void load();
  }, [activeId, load]);

  /* --------------------------------- actions -------------------------------- */

  const rename = async (session: ChatSession, title: string) => {
    const previous = session.title;
    setSessions((prev) =>
      prev.map((s) => (s.session_id === session.session_id ? { ...s, title } : s)),
    );
    try {
      await api.patch(`chat/sessions/${session.session_id}`, { title });
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.session_id === session.session_id ? { ...s, title: previous } : s)),
      );
      toast.error('Could not rename that chat');
    }
  };

  const exportSession = async (session: ChatSession, format: 'markdown' | 'json') => {
    const label = (session.title || 'snapmind-chat').replace(/[^\w\-]+/g, '-').slice(0, 60);
    try {
      const blob = await api.blob(`export/session/${session.session_id}`, undefined, {
        method: 'GET',
        query: { format },
      });
      downloadBlob(blob, `${label}.${format === 'markdown' ? 'md' : 'json'}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const id = pendingDelete.session_id;
    try {
      await api.del(`chat/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
      toast.success('Chat deleted');
      if (activeId === id) router.push('/text-generator');
    } catch {
      toast.error('Could not delete that chat');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  /* ---------------------------- search + grouping --------------------------- */

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? sessions.filter((s) => (s.title ?? '').toLowerCase().includes(needle))
      : sessions;

    // Rows arrive newest-first, so a single pass is enough to bucket them.
    // Grouped by the sortable day key, labelled with the human form.
    const out: { key: string; label: string; rows: ChatSession[] }[] = [];
    for (const s of filtered) {
      const key = s.updated_at ? dayKey(s.updated_at) : 'earlier';
      const last = out[out.length - 1];
      if (last?.key === key) last.rows.push(s);
      else out.push({ key, label: s.updated_at ? dayLabel(s.updated_at) : 'Earlier', rows: [s] });
    }
    return out;
  }, [sessions, q]);

  const empty = !loading && groups.length === 0;

  /* ---------------------------------- view --------------------------------- */

  if (!isOpen) {
    return (
      <div className="hidden shrink-0 flex-col items-center gap-2 border-l border-gray-100 px-2 py-4 lg:flex dark:border-white/10">
        <IconButton
          label="Show chat history"
          icon={<PanelRightOpen className="h-4 w-4" />}
          onClick={toggleIsOpen}
        />
      </div>
    );
  }

  return (
    <>
      {/* Below xl this overlays the transcript (the shell renders the scrim);
          from xl it sits in the shell's third grid column. */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-72 shrink-0 flex-col border-l border-gray-100 bg-white dark:border-white/10 dark:bg-dark-secondary xl:static xl:z-auto xl:bg-white/60 xl:dark:bg-dark-secondary/40">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Chats
          </h2>
          <IconButton
            label="Hide chat history"
            icon={<PanelRightClose className="h-4 w-4" />}
            onClick={toggleIsOpen}
          />
        </div>

        <div className="space-y-2 px-3 pb-3">
          <NewChat />
          <SearchInput value={q} onChange={setQ} placeholder="Search chats…" />
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {empty && (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title={q ? 'No chat matches that' : 'No chats yet'}
              description={
                q ? 'Try a shorter search.' : 'Ask your first question and it will show up here.'
              }
              className="!py-8"
            />
          )}

          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-1 px-1 text-[10.5px] font-bold uppercase tracking-wider text-gray-300 dark:text-gray-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.rows.map((s) => (
                  <SessionRow
                    key={s.session_id}
                    session={s}
                    active={s.session_id === activeId}
                    onOpen={() => router.push(`/text-generator?id=${s.session_id}`)}
                    onRename={(title) => void rename(s, title)}
                    onExport={(format) => void exportSession(s, format)}
                    onDelete={() => setPendingDelete(s)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-3 py-2.5 dark:border-white/10">
          <p className="flex items-center gap-1.5 text-[10.5px] text-gray-400 dark:text-gray-500">
            <Download className="h-3 w-3" />
            Export any chat from its ⋯ menu
          </p>
        </div>
      </aside>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this chat?"
        description={`“${pendingDelete?.title || 'Untitled chat'}” and its messages will be removed. The documents it cited stay in your knowledge base.`}
        confirmLabel="Delete chat"
        tone="danger"
        loading={deleting}
      />
    </>
  );
}
