'use client';

/**
 * Person Intelligence — `POST research/person_intelligence`, plus the LinkedIn
 * importer that exists because of how that route fails.
 *
 * The OSINT path searches for a LinkedIn profile first and, when it cannot pin
 * down exactly one, returns a *question* rather than an answer:
 * `status: "needs_more_info"` with the body prefixed `NEED_CLARIFICATION:`
 * (browser_agents.py:436). That is a normal outcome for a common name, so it gets
 * its own treatment instead of being rendered as a broken answer.
 *
 * The second half of the panel is the honest workaround for LinkedIn's auth wall.
 * `POST linkedin/scrape-post` scrapes headlessly and 403s on anything gated,
 * which is most things — so the primary path is to paste the post text from a
 * tab you are already signed into. `POST linkedin/parse` structures it and
 * ingests it in one call (linkedin.py:69), which is why it lands in your library
 * rather than just on screen.
 */

import { AnswerPanel, NeedsMoreInfo } from '@/components/dashboard/research/answer';
import { QueryField, RunButton, TextField } from '@/components/dashboard/research/fields';
import { ModeNotice, StageList } from '@/components/dashboard/research/run-progress';
import { Button, ErrorNote, Panel, Pill } from '@/components/dashboard/ui';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAgentRun } from '@/hooks/use-agent-run';
import { ApiError, api } from '@/lib/api-client';
import { PIPELINE_STAGES, researchBlocks, sourceLinks } from '@/lib/research';
import type { BrowserRunResult, LinkedInParseResult } from '@/lib/types';
import { Briefcase, UserSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

/* ---------------------------- linkedin importer ---------------------------- */

function LinkedInImporter({
  sessionId,
  workspaceId,
}: {
  sessionId: string;
  workspaceId?: string;
}) {
  const [url, setUrl] = useState('');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState<'idle' | 'scraping' | 'parsing'>('idle');
  const [imported, setImported] = useState<LinkedInParseResult['parsed_data'] | null>(null);

  /**
   * Optimistic path. It usually fails, and it is presented that way — the button
   * is secondary and its 403 is turned into an instruction rather than an error.
   */
  const tryScrape = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy('scraping');
    try {
      // `url` is a *query* parameter on this route, not a body field
      // (linkedin.py:82) — FastAPI reads a bare `str` argument from the query.
      const res = await api.post<{ success?: boolean; parsed_data?: Record<string, unknown> }>(
        'linkedin/scrape-post',
        undefined,
        { query: { url: u } },
      );
      const text = typeof res.parsed_data?.content === 'string' ? res.parsed_data.content : '';
      if (text) {
        setRaw(text);
        toast.success('Scraped the post — review it, then import.');
      } else {
        toast.error('The scrape returned nothing. Paste the post text instead.');
      }
    } catch (err) {
      const gated = err instanceof ApiError && (err.status === 403 || err.status === 401);
      toast.error(
        gated
          ? 'LinkedIn blocked the scrape. Open the post in a tab where you are signed in, select all, and paste it below.'
          : err instanceof Error
            ? err.message
            : 'The scrape failed.',
      );
    } finally {
      setBusy('idle');
    }
  };

  const importPost = async () => {
    const u = url.trim();
    const text = raw.trim();
    if (!u || !text) return;
    setBusy('parsing');
    try {
      const res = await api.post<LinkedInParseResult>('linkedin/parse', {
        url: u,
        raw_text: text,
        session_id: sessionId,
        workspace_id: workspaceId ?? null,
      });
      setImported(res.parsed_data ?? null);
      toast.success('Imported and indexed — it is queryable in chat now.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import the post.');
    } finally {
      setBusy('idle');
    }
  };

  return (
    <Panel className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
          <Briefcase className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Import a LinkedIn post
          </h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
            LinkedIn blocks anonymous scraping, so the reliable route is to copy the post from a tab
            you are signed into. SnapMind structures it and adds it to your library.
          </p>
        </div>
      </div>

      <TextField
        value={url}
        onChange={setUrl}
        type="url"
        label="Post URL"
        placeholder="https://www.linkedin.com/posts/…"
      />

      <QueryField
        value={raw}
        onChange={setRaw}
        rows={5}
        label="Post text"
        hint="Select the post in your browser and paste it here — author line, body, and engagement counts all get parsed out."
        placeholder="Paste the copied post…"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={importPost}
          loading={busy === 'parsing'}
          disabled={!url.trim() || !raw.trim() || busy !== 'idle'}
        >
          Import and index
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={tryScrape}
          loading={busy === 'scraping'}
          disabled={!url.trim() || busy !== 'idle'}
        >
          Try fetching it for me
        </Button>
      </div>

      {imported && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-gray-900 dark:text-white/90">
              {imported.author || 'Imported post'}
            </span>
            {imported.posted_at && imported.posted_at !== 'Unknown' && (
              <Pill tone="neutral">{imported.posted_at}</Pill>
            )}
            {/* `likes` comes back as a string on some posts and a number on
                others (the scraper reads it off the DOM), so both are accepted. */}
            {!!imported.likes && <Pill tone="neutral">{imported.likes} likes</Pill>}
          </div>
          {imported.author_headline && (
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
              {imported.author_headline}
            </p>
          )}
          {imported.content && (
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
              {imported.content}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------- panel --------------------------------- */

export default function PersonPanel({
  sessionId,
  initialQuery,
}: {
  sessionId: string;
  initialQuery?: string;
}) {
  const { activeWorkspace } = useWorkspace();
  const [query, setQuery] = useState(initialQuery ?? '');
  const run = useAgentRun<BrowserRunResult>();

  const start = () => {
    const q = query.trim();
    if (!q) return;
    void run.run((signal) =>
      api.post<BrowserRunResult>(
        'research/person_intelligence',
        { query: q, session_id: sessionId },
        { signal },
      ),
    );
  };

  const blocks = useMemo(() => researchBlocks(run.result?.blocks), [run.result?.blocks]);
  const links = useMemo(() => sourceLinks(run.result?.citations), [run.result?.citations]);

  const answer = run.result?.answer ?? '';
  const needsMore =
    run.result?.status === 'needs_more_info' || /^NEED_CLARIFICATION:/i.test(answer);

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <QueryField
          value={query}
          onChange={setQuery}
          onSubmit={start}
          autoFocus
          rows={2}
          label="Who are you looking into?"
          hint="A name alone rarely resolves. Add the company, city, or role — or paste their LinkedIn URL. ⌘/Ctrl + Enter runs it."
          placeholder="e.g. Priya Raman, staff engineer at a Bangalore fintech, works on payments infrastructure"
        />

        <div className="flex flex-wrap items-center justify-end gap-4">
          <RunButton
            running={run.running}
            onRun={start}
            onStop={run.stop}
            disabled={!query.trim()}
            label="Build a profile"
            runningLabel="Profiling…"
          />
        </div>

        <ModeNotice>
          Public sources only — the agent searches for a LinkedIn profile, reads it and corroborating
          pages, and cites what it used. It will ask for a disambiguator rather than guess between
          two people with the same name.
        </ModeNotice>
      </Panel>

      {run.running && (
        <StageList
          stages={PIPELINE_STAGES}
          elapsed={run.elapsed}
          running={run.running}
          onStop={run.stop}
        />
      )}

      {run.error && <ErrorNote message={run.error} onRetry={start} />}

      {answer && !run.running && needsMore && (
        <NeedsMoreInfo message={answer} onRefine={run.reset} />
      )}

      {answer && !run.running && !needsMore && (
        <AnswerPanel
          answer={answer}
          blocks={blocks}
          links={links}
          query={query.trim()}
          status={run.result?.status}
          lockedUrl={run.result?.locked_url}
          preamble={
            <p className="flex items-center gap-1.5 text-[11.5px] text-gray-500 dark:text-gray-400">
              <UserSearch className="h-3 w-3" />
              Assembled from public sources. Treat it as leads to verify, not established fact.
            </p>
          }
        />
      )}

      <LinkedInImporter sessionId={sessionId} workspaceId={activeWorkspace?.id} />
    </div>
  );
}
