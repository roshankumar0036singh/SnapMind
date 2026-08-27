'use client';

/**
 * The result surface shared by every research mode.
 *
 * Research answers are rendered with the same `Markdown` + `Citation` pair the
 * chat uses, so a `[br-block-1712-4]` tag in an agent answer becomes the same
 * hoverable chip it would be in a conversation. That only works because
 * `researchBlocks()` has already converted the agent's block shape — see
 * lib/research.ts.
 *
 * Two evidence renderers, because the backend returns two kinds of evidence:
 * modes that hand back `blocks[]` get the full source cards, and modes that hand
 * back only `citations[]` (debate, cross-lingual) get a link list, because there
 * is no chunk text to show. Pretending otherwise would mean inventing quotes.
 */

import { MessageSources } from '@/components/dashboard/chat/sources';
import Markdown from '@/components/dashboard/chat/markdown';
import { Button, IconButton, Panel, Pill } from '@/components/dashboard/ui';
import { useWorkspace } from '@/context/WorkspaceContext';
import { api } from '@/lib/api-client';
import { hostname } from '@/lib/format';
import { distinctSources, type SourceLink } from '@/lib/research';
import type { RetrievedBlock } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  BookmarkPlus,
  Check,
  Copy,
  ExternalLink,
  Lock,
  MessageSquarePlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

/* ------------------------------- source links ------------------------------ */

export function SourceLinkList({ links, label = 'Sources' }: { links: SourceLink[]; label?: string }) {
  if (!links.length) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label} · {links.length}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.url}>
            <a
              href={l.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-[12.5px] transition hover:border-primary-200 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-primary-500/40 dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[9px] font-bold uppercase text-gray-500 shadow-theme-xs dark:bg-white/10 dark:text-gray-300">
                {hostname(l.url).slice(0, 2) || 'W'}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                {l.label}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 text-gray-300 transition group-hover:text-primary-500 dark:text-gray-600" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- copy button ------------------------------ */

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      icon={copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
      label={copied ? 'Copied' : 'Copy the answer as Markdown'}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => toast.error('Could not copy to the clipboard'),
        );
      }}
    />
  );
}

/* -------------------------------- save action ------------------------------ */

function SaveToNotebook({ content, sourceUrl }: { content: string; sourceUrl?: string }) {
  const { activeWorkspace } = useWorkspace();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  return (
    <Button
      variant="outline"
      size="sm"
      loading={state === 'saving'}
      disabled={state === 'saved'}
      onClick={async () => {
        setState('saving');
        try {
          await api.post('bookmarks', {
            content,
            source_url: sourceUrl ?? null,
            workspace_id: activeWorkspace?.id ?? null,
            metadata: { origin: 'research' },
          });
          setState('saved');
          toast.success('Saved to your notebook');
        } catch (err) {
          setState('idle');
          toast.error(err instanceof Error ? err.message : 'Could not save this');
        }
      }}
    >
      {state === 'saved' ? (
        <>
          <Check className="h-3.5 w-3.5 text-success-600" />
          Saved
        </>
      ) : (
        <>
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save to notebook
        </>
      )}
    </Button>
  );
}

/* ------------------------------- answer panel ------------------------------ */

export function AnswerPanel({
  answer,
  blocks = [],
  links = [],
  /** The question that produced this — used to seed a chat follow-up. */
  query,
  /** Orchestrator `status`, shown only when it is not the plain success value. */
  status,
  lockedUrl,
  /** Rendered above the answer body — mode-specific context (translation, etc). */
  preamble,
  /** Extra buttons in the action row, before the shared ones. */
  actions,
  footnote,
}: {
  answer: string;
  blocks?: RetrievedBlock[];
  links?: SourceLink[];
  query?: string;
  status?: string;
  lockedUrl?: string | null;
  preamble?: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
}) {
  const router = useRouter();
  const sources = blocks.length ? distinctSources(blocks) : links.length;
  const abnormal = status && !/^(completed|success)$/i.test(status);

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {sources > 0 && (
            <Pill tone="neutral">
              {sources} source{sources === 1 ? '' : 's'}
            </Pill>
          )}
          {blocks.length > 0 && (
            <Pill tone="neutral">
              {blocks.length} cited chunk{blocks.length === 1 ? '' : 's'}
            </Pill>
          )}
          {abnormal && <Pill tone="warning">{status!.replace(/_/g, ' ')}</Pill>}
          {lockedUrl && (
            <a
              href={lockedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:hover:bg-primary-500/25"
              title="The agent treated this page as authoritative and read it in full"
            >
              <Lock className="h-3 w-3" />
              {hostname(lockedUrl)}
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(
                  `/text-generator?ask=${encodeURIComponent(
                    `Following up on my research into "${query}": `,
                  )}`,
                )
              }
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Follow up in chat
            </Button>
          )}
          <SaveToNotebook
            content={answer}
            sourceUrl={lockedUrl ?? links[0]?.url ?? blocks[0]?.source_url}
          />
          <CopyButton value={answer} />
        </div>
      </div>

      {preamble}

      <Markdown content={answer} blocks={blocks} />

      <div className="border-t border-gray-100 dark:border-white/10 pt-4 mt-6 pb-2">
        {blocks.length > 0 ? (
          <MessageSources blocks={blocks} />
        ) : (
          <SourceLinkList links={links} />
        )}
      </div>

      {footnote && (
        <p className="border-t border-gray-100 pt-3 text-[11.5px] leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400">
          {footnote}
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------ needs more info ---------------------------- */

/**
 * The person-intelligence path can come back asking for a disambiguator
 * (browser_agents.py:436). That is a prompt, not a failure, so it gets its own
 * treatment instead of being rendered as an answer that happens to start with
 * "NEED_CLARIFICATION".
 */
export function NeedsMoreInfo({
  message,
  onRefine,
}: {
  message: string;
  onRefine: () => void;
}) {
  return (
    <Panel className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            More detail needed
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            {message.replace(/^NEED_CLARIFICATION:\s*/i, '')}
          </p>
        </div>
      </div>
      <Button variant="soft" size="sm" onClick={onRefine} className="ml-12">
        Refine the search
      </Button>
    </Panel>
  );
}

/* --------------------------------- skeleton -------------------------------- */

export function AnswerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {[100, 96, 88, 92, 64].map((w, i) => (
        <div
          key={i}
          style={{ width: `${w}%` }}
          className="h-3.5 animate-pulse rounded-full bg-gray-100 dark:bg-white/10"
        />
      ))}
    </div>
  );
}
