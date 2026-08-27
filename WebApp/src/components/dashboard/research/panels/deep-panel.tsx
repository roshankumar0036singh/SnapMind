'use client';

/**
 * Deep Research — `POST research/deep-research/stream`.
 *
 * The only mode with real progress. The reasoning chain yields a plan first, then
 * a `processing`/`completed` pair per hop, then a synthesis thought, then the
 * final answer (reasoning_chain.py:96-199) — so this panel streams the NDJSON
 * route and drives `HopTimeline` from actual events rather than a guess.
 *
 * Two honesty notes that shape the form:
 *
 * 1. There are **no depth or breadth controls**, because the planner takes
 *    neither. It decides how many sub-questions the question deserves and is
 *    hard-capped at five (reasoning_chain.py:79). A slider here would be a knob
 *    wired to nothing.
 * 2. Hops are sequential, and a `local_rag` hop searches your own library while a
 *    `web_search` hop runs a full browser agent — so a five-step chain can take
 *    several minutes. The clock and the per-hop ticks are what make that legible.
 */

import { AnswerPanel } from '@/components/dashboard/research/answer';
import { QueryField, RunButton } from '@/components/dashboard/research/fields';
import {
  HopTimeline,
  ModeNotice,
  type HopStatus,
} from '@/components/dashboard/research/run-progress';
import { Button, ErrorNote, Panel, Select } from '@/components/dashboard/ui';
import { OUTPUT_LANGUAGES, useSettings } from '@/context/SettingsContext';
import { useAgentRun } from '@/hooks/use-agent-run';
import { ApiError, streamNDJSON } from '@/lib/api-client';
import { hostname } from '@/lib/format';
import { researchBlocks, sourceLinks } from '@/lib/research';
import type {
  DeepResearchEvent,
  DeepResearchResult,
  ReasoningChainStep,
  ReasoningPlanStep,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronDown, Compass, Database, ExternalLink, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

/* ------------------------------- chain detail ------------------------------ */

/**
 * The per-hop answers, collapsed.
 *
 * `HopTimeline` shows *where* the chain got to; this shows *what each hop found*,
 * which is the part that makes a multi-hop answer auditable. Kept local to this
 * panel because `chain[]` is unique to the reasoning route — the chat's shared
 * `ReasoningTimeline` renders thoughts, not answers with sources.
 */
function ChainSteps({ chain }: { chain: ReasoningChainStep[] }) {
  const [open, setOpen] = useState(false);
  if (!chain.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-gray-50/70 px-4 py-2.5 text-left transition hover:bg-gray-100/70 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
      >
        <span className="flex-1 text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
          What each step found · {chain.length}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ol className="divide-y divide-gray-100 dark:divide-white/10">
          {chain.map((step, i) => (
            <li key={step.id ?? i} className="px-4 py-3.5">
              <p className="flex items-baseline gap-2 text-[12.5px] font-semibold text-gray-900 dark:text-white/90">
                <span className="tabular-nums text-gray-400 dark:text-gray-500">
                  {step.id ?? i + 1}.
                </span>
                <span className="min-w-0">{step.thought?.replace(/^Completed research for:\s*/i, '')}</span>
              </p>
              {step.answer && (
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
                  {step.answer}
                </p>
              )}
              {!!step.sources?.length && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {step.sources
                    .filter((s) => /^https?:\/\//i.test(s))
                    .map((s) => (
                      <li key={s}>
                        <a
                          href={s}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 transition hover:bg-primary-50 hover:text-primary-700 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-primary-500/15 dark:hover:text-primary-300"
                        >
                          {hostname(s)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------------------------------- panel --------------------------------- */

export default function DeepPanel({
  sessionId,
  initialQuery,
}: {
  sessionId: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { prefs } = useSettings();

  const [query, setQuery] = useState(initialQuery ?? '');
  const [lang, setLang] = useState<string>(prefs.outputLang);

  // Live stream state. Kept beside the run rather than inside it because these
  // arrive *during* the request, while `run.result` only exists at the end.
  const [plan, setPlan] = useState<ReasoningPlanStep[]>([]);
  const [statuses, setStatuses] = useState<Record<number, HopStatus>>({});
  const [synthesising, setSynthesising] = useState(false);

  const run = useAgentRun<DeepResearchResult>();

  const start = () => {
    const q = query.trim();
    if (!q) return;

    setPlan([]);
    setStatuses({});
    setSynthesising(false);

    void run.run(async (signal) => {
      let final: DeepResearchResult | undefined;
      // A stream `error` event is captured and rethrown *after* the stream drains,
      // so the partial timeline stays on screen and the reader sees how far the
      // chain got before it broke.
      let streamError: string | undefined;

      await streamNDJSON<DeepResearchEvent>(
        'research/deep-research/stream',
        { query: q, session_id: sessionId, target_language: lang },
        (event) => {
          switch (event.type) {
            case 'plan':
              setPlan(event.plan ?? []);
              break;

            case 'thought':
              // A thought with no `step` is the final-synthesis notice
              // (reasoning_chain.py:189) — the chain's last row, not a hop.
              if (typeof event.step === 'number') {
                const step = event.step;
                setStatuses((prev) => ({
                  ...prev,
                  [step]: event.status === 'completed' ? 'completed' : 'processing',
                }));
              } else {
                setSynthesising(true);
              }
              break;

            case 'final':
              final = event;
              setSynthesising(true);
              break;

            case 'error':
              streamError = event.error || 'The reasoning chain failed.';
              break;
          }
        },
        { signal },
      );

      if (streamError) throw new ApiError(500, streamError);
      if (!final) throw new ApiError(500, 'The reasoning chain produced no answer.');
      return final;
    });
  };

  const blocks = useMemo(() => researchBlocks(run.result?.blocks), [run.result?.blocks]);
  const links = useMemo(() => sourceLinks(run.result?.citations), [run.result?.citations]);
  const chain = run.result?.chain ?? [];

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <QueryField
          value={query}
          onChange={setQuery}
          onSubmit={start}
          autoFocus
          rows={3}
          label="Ask something that needs more than one search"
          hint="Comparisons, causal chains, and anything where the second question depends on the first answer. ⌘/Ctrl + Enter runs it."
          placeholder="e.g. How did the 2026 EU AI rules change what open-weight model providers must publish, and which providers have complied so far?"
        />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
              Answer language
            </span>
            <Select
              label="Answer language"
              value={lang}
              onChange={setLang}
              options={OUTPUT_LANGUAGES.map((l) => ({ value: l.value as string, label: l.label }))}
            />
          </label>
          <RunButton
            running={run.running}
            onRun={start}
            onStop={run.stop}
            disabled={!query.trim()}
            label="Start the chain"
            runningLabel="Reasoning…"
          />
        </div>

        <div className="grid gap-2 border-t border-gray-100 pt-4 sm:grid-cols-2 dark:border-white/10">
          <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            <Globe className="mt-[1px] h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
              <span className="font-medium text-gray-600 dark:text-gray-300">Web steps</span> run a
              full browser agent — search, rank, scrape, cite.
            </span>
          </p>
          <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            <Database className="mt-[1px] h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
              <span className="font-medium text-gray-600 dark:text-gray-300">Library steps</span>{' '}
              search what you have already ingested instead.
            </span>
          </p>
        </div>

        <ModeNotice>
          The planner decides how many steps your question needs, up to five — there is no depth
          dial. Steps run one after another and each web step is a full agent run, so a long chain
          can take several minutes.
        </ModeNotice>
      </Panel>

      {(run.running || plan.length > 0) && !run.result?.answer && (
        <HopTimeline
          plan={plan}
          statuses={statuses}
          synthesising={synthesising}
          elapsed={run.elapsed}
          running={run.running}
          onStop={run.stop}
        />
      )}

      {run.error && <ErrorNote message={run.error} onRetry={start} />}

      {run.result?.answer && !run.running && (
        <>
          <AnswerPanel
            answer={run.result.answer}
            blocks={blocks}
            links={links}
            query={query.trim()}
            preamble={
              plan.length > 0 ? (
                <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
                  Answered across {plan.length} research step{plan.length === 1 ? '' : 's'} in{' '}
                  {Math.round(run.elapsed / 1000)}s.
                </p>
              ) : undefined
            }
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  router.push(`/research?mode=browser&q=${encodeURIComponent(query.trim())}`)
                }
              >
                <Compass className="h-3.5 w-3.5" />
                Re-run as one search
              </Button>
            }
          />
          <ChainSteps chain={chain} />
        </>
      )}
    </div>
  );
}
