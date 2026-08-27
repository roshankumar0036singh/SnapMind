'use client';

/**
 * Browser Mode — `POST research/research` (research.py:9).
 *
 * Two things about this endpoint shape the screen:
 *
 * 1. It is one blocking call. The orchestrator reports its stages to the server's
 *    stdout only, so there is no live progress to show; `StageList` explains the
 *    pipeline and the clock is the only real signal. See lib/research.ts.
 * 2. It writes to your knowledge base. Every page the agent scrapes is
 *    background-ingested into the vector store under this run's session id
 *    (browser_agents.py:518-617). That is genuinely useful — it is how a report
 *    can be generated afterwards — but it is a side effect worth stating rather
 *    than discovering later in the Library.
 */

import { AnswerPanel } from '@/components/dashboard/research/answer';
import { QueryField, RunButton } from '@/components/dashboard/research/fields';
import { ModeNotice, StageList } from '@/components/dashboard/research/run-progress';
import { Button, ErrorNote, Panel, Segmented, Toggle } from '@/components/dashboard/ui';
import { useSettings } from '@/context/SettingsContext';
import { useAgentRun } from '@/hooks/use-agent-run';
import { api } from '@/lib/api-client';
import { PIPELINE_STAGES, researchBlocks, sourceLinks } from '@/lib/research';
import type { BrowserRunResult, ResearchMode } from '@/lib/types';
import { FileText, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const MODE_OPTIONS: { value: ResearchMode; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'scholar', label: 'Scholarly' },
  { value: 'legal', label: 'Legal' },
];

const MODE_HINT: Record<ResearchMode, string> = {
  general: 'Ranks ordinary web sources by credibility.',
  scholar: 'Favours papers, preprints and citations over blog posts.',
  legal: 'Favours statutes, filings and case law over commentary.',
};

export default function BrowserPanel({
  sessionId,
  workspaceId,
  initialQuery,
}: {
  sessionId: string;
  workspaceId?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { prefs } = useSettings();

  const [query, setQuery] = useState(initialQuery ?? '');
  const [mode, setMode] = useState<ResearchMode>('general');
  const [queryNotebook, setQueryNotebook] = useState(prefs.retrieval.queryNotebook);

  const run = useAgentRun<BrowserRunResult>();

  const start = () => {
    const q = query.trim();
    if (!q) return;
    void run.run((signal) =>
      api.post<BrowserRunResult>(
        'research/research',
        {
          session_id: sessionId,
          workspace_id: workspaceId ?? null,
          query: q,
          output_lang: prefs.outputLang,
          query_notebook: queryNotebook,
          research_mode: mode,
        },
        { signal },
      ),
    );
  };

  const blocks = useMemo(() => researchBlocks(run.result?.blocks), [run.result?.blocks]);
  const links = useMemo(() => sourceLinks(run.result?.citations), [run.result?.citations]);

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <QueryField
          value={query}
          onChange={setQuery}
          onSubmit={start}
          autoFocus
          rows={3}
          label="What should the agent find out?"
          hint="Written as a question or a task. ⌘/Ctrl + Enter runs it."
          placeholder="e.g. Which EU regulations came into force in 2026 for AI model providers, and what do they require?"
        />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400">{MODE_HINT[mode]}</p>
          </div>
          <RunButton
            running={run.running}
            onRun={start}
            onStop={run.stop}
            disabled={!query.trim()}
            label="Research the web"
            runningLabel="Researching…"
          />
        </div>

        <div className="border-t border-gray-100 pt-4 dark:border-white/10">
          <Toggle
            checked={queryNotebook}
            onChange={setQueryNotebook}
            label="Cross-reference my notebook"
            hint="Weighs what you have already saved alongside the web results."
          />
        </div>

        <ModeNotice>
          Pages the agent reads are added to your knowledge base under this run, so you can query
          them in chat afterwards — and generate a report from them. Needs a Gemini or Mistral key,
          plus Firecrawl for scraping.
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

      {run.result?.answer && !run.running && (
        <AnswerPanel
          answer={run.result.answer}
          blocks={blocks}
          links={links}
          query={query.trim()}
          status={run.result.status}
          lockedUrl={run.result.locked_url}
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  router.push(
                    `/research?mode=report&session=${encodeURIComponent(
                      sessionId,
                    )}&q=${encodeURIComponent(query.trim())}`,
                  )
                }
              >
                <FileText className="h-3.5 w-3.5" />
                Write a report
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  router.push(`/research?mode=debate&q=${encodeURIComponent(query.trim())}`)
                }
              >
                <Scale className="h-3.5 w-3.5" />
                Argue both sides
              </Button>
            </>
          }
          footnote={
            <>
              Sources from this run were indexed into your knowledge base. Give the indexing a
              moment before generating a report — the report route answers{' '}
              <span className="font-medium">ingestion pending</span> until it finishes.
            </>
          }
        />
      )}
    </div>
  );
}
