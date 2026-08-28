'use client';

/**
 * Inline citation chip.
 *
 * The model emits bare ids — `[db-block-3]`, `[nb-block-1]`, `[br-block-1712-5]`.
 * Showing those to a reader is noise, so each chip renders a handle derived from
 * the source title (`SSOC 3`) and resolves the id against the retrieved blocks of
 * the message it belongs to. Clicking opens the source scrolled to the cited
 * sentence: `#page=N` for PDFs, a W3C text fragment for everything else.
 */

import { PANEL, Spinner } from '@/components/dashboard/ui';
import {
  citationHandle,
  citationHref,
  hostname,
  prettyUrl,
  SOURCE_ACCENT,
  SOURCE_LABELS,
  sourceKind,
  truncate,
} from '@/lib/format';
import type { RetrievedBlock } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BookMarked, ExternalLink, FileText, Save, Check } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useWorkspace } from '@/context/WorkspaceContext';
import { toast } from 'sonner';

/** Credibility tiers the backend assigns (services/search_service.py). */
const TIER_STYLE: Record<string, string> = {
  expert: 'text-success-600 bg-success-50 dark:bg-success-600/15',
  authoritative: 'text-success-600 bg-success-50 dark:bg-success-600/15',
  reliable: 'text-primary-600 bg-primary-50 dark:bg-primary-500/15 dark:text-primary-300',
  standard: 'text-gray-600 bg-gray-100 dark:bg-white/10 dark:text-gray-300',
  unverified: 'text-error-500 bg-error-50 dark:bg-error-500/15',
};

export function blockUrl(block?: RetrievedBlock): string | undefined {
  return block?.url && block.url !== 'local' ? block.url : block?.source_url || undefined;
}

function blockTitle(block?: RetrievedBlock): string | undefined {
  if (!block) return undefined;
  const url = blockUrl(block);
  return block.title || (block.metadata?.title as string | undefined) || (url ? hostname(url) : undefined);
}

/* ------------------------------- source card ------------------------------ */

/** The hover/tap card. Also reused by the sources panel, hence the export. */
export function SourcePreview({ id, block }: { id: string; block?: RetrievedBlock }) {
  const url = blockUrl(block);
  const kind = sourceKind(url);
  const tier = block?.credibility_tier?.toLowerCase();
  const isNotebook = id.startsWith('nb-');
  const page = block?.metadata?.page;

  const { activeWorkspace } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveToNotebook = async () => {
    if (saved || saving || !block?.content) return;
    setSaving(true);
    const title = blockTitle(block) ?? citationHandle(id);
    const contentToSave = `${title}\n\n${block.content}`;
    try {
      await api.post('bookmarks', {
        content: contentToSave,
        source_url: url || null,
        workspace_id: activeWorkspace?.id ?? null,
        metadata: { origin: 'web', citation_id: id },
      });
      setSaved(true);
      toast.success('Saved to your notebook');
    } catch (err) {
      toast.error('Could not save to notebook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className={cn(PANEL, 'block w-80 max-w-[85vw] p-3.5 text-left')}>
      <span className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            isNotebook ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' : SOURCE_ACCENT[kind],
          )}
        >
          {isNotebook ? <BookMarked className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        </span>

        <span className="min-w-0 flex-1 block">
          <span className="block truncate text-[13px] font-semibold text-gray-900 dark:text-white">
            {blockTitle(block) ?? citationHandle(id)}
          </span>
          <span className="block mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
            {isNotebook ? 'Saved in your notebook' : url ? prettyUrl(url, 44) : SOURCE_LABELS[kind]}
          </span>
        </span>
      </span>

      {block?.content ? (
        <span className="block mt-2.5 line-clamp-4 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {truncate(block.highlight_snippet || block.content, 260)}
        </span>
      ) : (
        <span className="block mt-2.5 text-xs italic text-gray-400 dark:text-gray-500">
          This source was not returned with the answer.
        </span>
      )}

      <span className="flex mt-3 items-center gap-1.5">
        {tier && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              TIER_STYLE[tier] ?? TIER_STYLE.standard,
            )}
          >
            {tier}
          </span>
        )}
        {typeof block?.similarity === 'number' && (
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {block.similarity < 0.01 && block.similarity > 0 ? '<1' : Math.round(block.similarity * 100)}% match
          </span>
        )}
        {typeof page === 'number' && (
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
            p.{page}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-gray-400 dark:text-gray-500">{id}</span>
      </span>

      <span className="mt-2.5 flex items-center justify-between">
        {url ? (
          <a
            href={citationHref(url, block?.highlight_snippet || block?.content, typeof page === 'number' ? page : undefined)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Open at the cited text
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : <span />}

        {!isNotebook && block?.content && (
          <button
            type="button"
            onClick={saveToNotebook}
            disabled={saved || saving}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 transition hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {saving ? <Spinner className="h-3 w-3" /> : saved ? <Check className="h-3 w-3 text-success-500" /> : <Save className="h-3 w-3" />}
            {saved ? 'Saved' : 'Save to notebook'}
          </button>
        )}
      </span>
    </span>
  );
}

/* ---------------------------------- chip ---------------------------------- */

export default function CitationChip({
  id,
  blocks,
  index,
}: {
  id: string;
  blocks?: RetrievedBlock[];
  /** Position in the answer, used only as a fallback label. */
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const block = blocks?.find((b) => b.id === id);
  const url = blockUrl(block);
  const page = block?.metadata?.page;
  const handle = citationHandle(id, blockTitle(block)) || `SRC ${index ?? ''}`.trim();

  const chip = (
    <span
      className={cn(
        'mx-0.5 inline-flex translate-y-[-1px] items-baseline gap-0.5 rounded-full px-1.5 py-px align-baseline',
        'text-[10px] font-bold uppercase leading-[1.4] tracking-wide no-underline transition',
        block
          ? 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/30 dark:hover:bg-primary-500/25'
          : 'bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200 dark:bg-white/10 dark:text-gray-400 dark:ring-white/10',
      )}
    >
      {handle}
    </span>
  );

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {url ? (
        <a
          href={citationHref(url, block?.highlight_snippet || block?.content, typeof page === 'number' ? page : undefined)}
          target="_blank"
          rel="noreferrer noopener"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label={`Source ${handle}. Opens ${hostname(url)} at the cited text.`}
        >
          {chip}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label={`Source ${handle}`}
        >
          {chip}
        </button>
      )}

      {open && (
        <span className="absolute bottom-full left-1/2 z-50 block -translate-x-1/2 pb-2">
          <SourcePreview id={id} block={block} />
        </span>
      )}
    </span>
  );
}
