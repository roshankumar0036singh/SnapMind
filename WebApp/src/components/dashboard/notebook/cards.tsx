'use client';

/**
 * Notebook cards.
 *
 * Two shapes, two very different guarantees, which is why they are two cards and
 * not one:
 *
 *  - A **note** (`bookmarks` row) keeps the text you saved *and* an embedding of
 *    it, so it is recallable in chat. `POST bookmarks` embeds at save time, which
 *    is why saving needs a Gemini or Mistral key (bookmarks.py:36).
 *  - A **saved page** (`saved_pages` row) keeps only what the extraction pass
 *    wrote — title, summary, keywords, emotions — and never the page text
 *    (saved_pages.py:114). It is a reading list, not knowledge: nothing here is
 *    in `documents`, so chat cannot cite it until the page is actually indexed.
 *    Hence "Index it" on every page card.
 */

import { Button, IconButton, Pill } from '@/components/dashboard/ui';
import { hostname, prettyUrl, relativeTime, truncate } from '@/lib/format';
import type { Bookmark, SavedPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  Copy,
  DatabaseZap,
  ExternalLink,
  FolderOpen,
  Quote,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/* ---------------------------------- notes --------------------------------- */

export function NoteCard({
  note,
  selected,
  onToggle,
  onDelete,
}: {
  note: Bookmark;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const content = note.content ?? '';
  const long = content.length > 320;
  const origin = typeof note.metadata?.origin === 'string' ? note.metadata.origin : undefined;
  const host = hostname(note.source_url);

  const copy = () => {
    void navigator.clipboard.writeText(content).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => toast.error('Could not copy to the clipboard'),
    );
  };

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-theme-xs transition dark:bg-white/[0.03]',
        selected
          ? 'border-primary-300 ring-1 ring-primary-200 dark:border-primary-500/50 dark:ring-primary-500/25'
          : 'border-gray-100 hover:shadow-theme-sm dark:border-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <Quote className="h-3.5 w-3.5" />
        </span>

        {/* Native checkbox: the card is wide and the label is the whole card, so
            a hit target this size is fine and keyboard focus lands where a
            reader expects. */}
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="sr-only">Select this note</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500/40 dark:border-white/20 dark:bg-white/10"
          />
        </label>
      </div>

      <p
        className={cn(
          'whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-200',
          !expanded && 'line-clamp-6',
        )}
      >
        {content}
      </p>

      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-[11.5px] font-medium text-primary-600 transition hover:text-primary-700 dark:text-primary-400"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {origin && <Pill tone="neutral">{origin}</Pill>}
        {note.source_url ? (
          <a
            href={note.source_url}
            target="_blank"
            rel="noopener noreferrer"
            title={note.source_url}
            className="inline-flex max-w-[15rem] items-center gap-1 truncate text-[11.5px] text-gray-500 transition hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            {host || prettyUrl(note.source_url, 34)}
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        ) : (
          <span className="text-[11.5px] text-gray-400 dark:text-gray-500">No source</span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-white/10">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {note.created_at ? `Saved ${relativeTime(note.created_at)}` : 'Saved'}
        </span>
        <div className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100 focus-within:opacity-100">
          <IconButton
            icon={
              copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />
            }
            label={copied ? 'Copied' : 'Copy the note'}
            onClick={copy}
          />
          <IconButton
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete this note"
            onClick={onDelete}
            className="hover:text-error-600"
          />
        </div>
      </div>
    </article>
  );
}

/* ------------------------------- saved pages ------------------------------ */

export function SavedPageCard({
  page,
  onIndex,
  onDelete,
  deleteHint,
}: {
  page: SavedPage;
  onIndex: () => void;
  onDelete: () => void;
  /** Set when deletion is impossible here — explains why instead of failing. */
  deleteHint?: string;
}) {
  const host = hostname(page.original_url);
  const keywords = (page.keywords ?? []).filter(Boolean).slice(0, 6);
  const emotions = (page.emotions ?? []).filter(Boolean).slice(0, 2);

  return (
    <article className="group flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-theme-xs transition hover:shadow-theme-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold text-gray-900 dark:text-white/90">
            {page.title?.trim() || prettyUrl(page.original_url, 44)}
          </h3>
          <a
            href={page.original_url}
            target="_blank"
            rel="noopener noreferrer"
            title={page.original_url}
            className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-gray-500 transition hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            {host || prettyUrl(page.original_url, 34)}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        {page.folder_name && (
          <Pill tone="brand" className="shrink-0">
            <FolderOpen className="h-3 w-3" />
            {page.folder_name}
          </Pill>
        )}
      </div>

      {page.summary && (
        <p className="line-clamp-4 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
          {truncate(page.summary, 420)}
        </p>
      )}

      {(keywords.length > 0 || emotions.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <Pill key={k} tone="neutral">
              {k}
            </Pill>
          ))}
          {emotions.map((e) => (
            <Pill key={e} tone="warning">
              {e}
            </Pill>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-white/10">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {page.created_at ? `Saved ${relativeTime(page.created_at)}` : 'Saved'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onIndex}>
            <DatabaseZap className="h-3.5 w-3.5" />
            Index it
          </Button>
          <IconButton
            icon={<Trash2 className="h-4 w-4" />}
            label={deleteHint ?? 'Delete this page'}
            onClick={onDelete}
            disabled={!!deleteHint}
            className="hover:text-error-600"
          />
        </div>
      </div>
    </article>
  );
}
