'use client';

/**
 * Scrape — `POST research/scrape`.
 *
 * The plainest route in the app: one URL in, clean Markdown out, and explicitly
 * *not* indexed (research.py:189). That last part is the point of having it
 * separate from Capture — sometimes you want to read a page, not keep it.
 *
 * Because it deliberately skips ingestion, the panel offers ingestion as an
 * afterwards action rather than doing it silently. `POST ingest` with `text` set
 * takes the Markdown we already have, so keeping the page costs no second fetch
 * and no Firecrawl credit.
 */

import { RunButton, TextField } from '@/components/dashboard/research/fields';
import { ModeNotice, RunClock } from '@/components/dashboard/research/run-progress';
import { Button, ErrorNote, IconButton, Panel, Pill, Spinner } from '@/components/dashboard/ui';
import Markdown from '@/components/dashboard/chat/markdown';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAgentRun } from '@/hooks/use-agent-run';
import { api } from '@/lib/api-client';
import { downloadBlob, hostname, prettyUrl } from '@/lib/format';
import type { ScrapeResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  Code2,
  Copy,
  DatabaseZap,
  Download,
  ExternalLink,
  Eye,
  MessageSquarePlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ScrapePanel({
  sessionId,
  workspaceId,
  initialQuery,
}: {
  sessionId: string;
  workspaceId?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [url, setUrl] = useState(initialQuery ?? '');
  const [view, setView] = useState<'rendered' | 'source'>('rendered');
  const [copied, setCopied] = useState(false);
  const [keeping, setKeeping] = useState<'idle' | 'saving' | 'saved'>('idle');

  const run = useAgentRun<ScrapeResult>();

  const start = () => {
    const u = url.trim();
    if (!u) return;
    setKeeping('idle');
    void run.run((signal) => api.post<ScrapeResult>('research/scrape', { url: u }, { signal }));
  };

  const md = run.result?.markdown ?? '';
  const words = md ? md.trim().split(/\s+/).length : 0;

  const keep = async () => {
    if (!md) return;
    setKeeping('saving');
    try {
      await api.post('ingest', {
        url: run.result?.url ?? url.trim(),
        text: md,
        title: run.result?.title || hostname(url),
        session_id: sessionId,
        workspace_id: workspaceId ?? activeWorkspace?.id ?? null,
        metadata: { origin: 'scrape' },
      });
      setKeeping('saved');
      toast.success('Indexed — you can ask questions about it in chat now.');
    } catch (err) {
      setKeeping('idle');
      toast.error(err instanceof Error ? err.message : 'Could not index this page.');
    }
  };

  const copy = () => {
    void navigator.clipboard.writeText(md).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => toast.error('Could not copy to the clipboard'),
    );
  };

  const save = () => {
    const name = `${(run.result?.title || hostname(url) || 'page').replace(/[^\w.-]+/g, '-').slice(0, 60)}.md`;
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), name);
  };

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            value={url}
            onChange={setUrl}
            onSubmit={start}
            type="url"
            label="Page to read"
            hint="One page, converted to Markdown. Nothing is saved unless you ask."
            placeholder="https://example.com/article"
            className="min-w-[260px] flex-1"
          />
          <RunButton
            running={run.running}
            onRun={start}
            onStop={run.stop}
            disabled={!url.trim()}
            label="Read the page"
            runningLabel="Reading…"
          />
        </div>

        <ModeNotice>
          Uses your Firecrawl key when you have set one and falls back to a direct fetch otherwise,
          so paywalled and script-rendered pages may come back thin. Nothing here is indexed — use{' '}
          <span className="font-medium">Keep this page</span> below if you want it in your library.
        </ModeNotice>
      </Panel>

      {run.running && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-gray-700 dark:text-gray-200">
            <Spinner className="h-3.5 w-3.5" />
            <span className="truncate">Fetching {prettyUrl(url, 48)}</span>
          </span>
          <RunClock elapsed={run.elapsed} running />
        </div>
      )}

      {run.error && <ErrorNote message={run.error} onRetry={start} />}

      {md && !run.running && (
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                {run.result?.title || hostname(run.result?.url ?? url)}
              </h3>
              <a
                href={run.result?.url ?? url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-gray-500 transition hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
              >
                {prettyUrl(run.result?.url ?? url, 56)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone="neutral">{words.toLocaleString()} words</Pill>

              {/* Rendered / source toggle, built inline rather than with
                  `Segmented` so the two icon buttons sit flush with the copy and
                  download controls beside them. */}
              <div className="flex items-center rounded-full bg-gray-100 p-0.5 dark:bg-white/10">
                {(
                  [
                    { id: 'rendered' as const, icon: Eye, label: 'Rendered' },
                    { id: 'source' as const, icon: Code2, label: 'Markdown' },
                  ]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setView(t.id)}
                    aria-pressed={view === t.id}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition',
                      view === t.id
                        ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-white/15 dark:text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white',
                    )}
                  >
                    <t.icon className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>

              <IconButton
                icon={
                  copied ? (
                    <Check className="h-4 w-4 text-success-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
                label={copied ? 'Copied' : 'Copy the Markdown'}
                onClick={copy}
              />
              <IconButton
                icon={<Download className="h-4 w-4" />}
                label="Download as .md"
                onClick={save}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-y border-gray-100 py-3 dark:border-white/10">
            <Button
              variant="outline"
              size="sm"
              onClick={keep}
              loading={keeping === 'saving'}
              disabled={keeping === 'saved'}
            >
              {keeping === 'saved' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success-600" />
                  In your library
                </>
              ) : (
                <>
                  <DatabaseZap className="h-3.5 w-3.5" />
                  Keep this page
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(
                  `/text-generator?ask=${encodeURIComponent(
                    `About ${run.result?.url ?? url.trim()}: `,
                  )}`,
                )
              }
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Ask about it in chat
            </Button>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              Chat can only cite it once it is in your library.
            </span>
          </div>

          {view === 'rendered' ? (
            <Markdown content={md} />
          ) : (
            <pre className="custom-scrollbar max-h-[32rem] overflow-auto rounded-2xl bg-gray-50 p-4 text-[12px] leading-relaxed text-gray-700 dark:bg-white/5 dark:text-gray-300">
              {md}
            </pre>
          )}
        </Panel>
      )}
    </div>
  );
}
