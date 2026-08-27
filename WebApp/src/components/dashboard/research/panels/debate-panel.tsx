'use client';

/**
 * Debate — `POST research/debate`.
 *
 * The most expensive mode in the app, and the form says so up front: it starts
 * *two* full browser agents concurrently — one told to argue for the premise, one
 * against — then hands both reports to a moderator model (research.py:277-307).
 * Two agent runs plus a synthesis pass means roughly double the latency and cost
 * of Browser Mode, which is worth knowing before pressing the button rather than
 * after.
 *
 * The response carries `sources`, `pro_sources` and `con_sources`, all of which
 * are *citations* — pointers with no chunk text — so evidence is rendered as
 * links, split by side. That split is the interesting part of the output: it shows
 * which corner of the web each argument was built from.
 *
 * Both agents are hard-coded to `output_lang="English"` (research.py:278) and the
 * moderator prompt carries no language instruction, so there is no language
 * control here. Offering one would be a lie.
 */

import { AnswerPanel, SourceLinkList } from '@/components/dashboard/research/answer';
import { QueryField, RunButton } from '@/components/dashboard/research/fields';
import { ModeNotice, StageList } from '@/components/dashboard/research/run-progress';
import { Button, ErrorNote, Panel } from '@/components/dashboard/ui';
import { useAgentRun } from '@/hooks/use-agent-run';
import { api } from '@/lib/api-client';
import { PIPELINE_STAGES, sourceLinks } from '@/lib/research';
import type { DebateResult } from '@/lib/types';
import { FileText, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function DebatePanel({
  sessionId,
  initialQuery,
}: {
  sessionId: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialQuery ?? '');
  const run = useAgentRun<DebateResult>();

  const start = () => {
    const t = topic.trim();
    if (!t) return;
    void run.run((signal) =>
      api.post<DebateResult>('research/debate', { topic: t, session_id: sessionId }, { signal }),
    );
  };

  const pro = useMemo(() => sourceLinks(run.result?.pro_sources), [run.result?.pro_sources]);
  const con = useMemo(() => sourceLinks(run.result?.con_sources), [run.result?.con_sources]);
  const combined = useMemo(() => sourceLinks(run.result?.sources), [run.result?.sources]);

  /** Sources only one side found — where the two research paths actually diverged. */
  const exclusive = useMemo(() => {
    const proUrls = new Set(pro.map((l) => l.url));
    const conUrls = new Set(con.map((l) => l.url));
    return {
      pro: pro.filter((l) => !conUrls.has(l.url)),
      con: con.filter((l) => !proUrls.has(l.url)),
      shared: pro.filter((l) => conUrls.has(l.url)).length,
    };
  }, [pro, con]);

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <QueryField
          value={topic}
          onChange={setTopic}
          onSubmit={start}
          autoFocus
          rows={2}
          label="State it as a claim, not a question"
          hint="The two agents argue for and against whatever you write, so a flat premise works far better than “what do people think about…”. ⌘/Ctrl + Enter runs it."
          placeholder="e.g. Retrieval-augmented generation has made long-context models unnecessary for enterprise search"
        />

        <div className="flex flex-wrap items-center justify-end gap-4">
          <RunButton
            running={run.running}
            onRun={start}
            onStop={run.stop}
            disabled={!topic.trim()}
            label="Argue both sides"
            runningLabel="Debating…"
          />
        </div>

        <ModeNotice tone="warning">
          This runs two complete browser agents at the same time, then a third model moderates
          between them — expect roughly double the wait and the cost of a single search. The
          transcript is written in English regardless of your language setting.
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
        <>
          <AnswerPanel
            answer={run.result.answer}
            query={topic.trim()}
            preamble={
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
                A moderated transcript between two independently-researched positions on{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {run.result.topic || topic.trim()}
                </span>
                . {combined.length} source{combined.length === 1 ? '' : 's'} across both sides.
              </p>
            }
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  router.push(
                    `/research?mode=report&session=${encodeURIComponent(
                      `${sessionId}-pro`,
                    )},${encodeURIComponent(`${sessionId}-con`)}&q=${encodeURIComponent(
                      topic.trim(),
                    )}`,
                  )
                }
              >
                <FileText className="h-3.5 w-3.5" />
                Write this up
              </Button>
            }
            footnote={
              <>
                Each side ingested its own sources under a separate session, so a report written
                from this debate draws on both. Give the indexing a moment first.
              </>
            }
          />

          {/* The split is the point: the same claim researched twice, from
              different corners of the web. */}
          <Panel className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Where each side looked
              </h3>
              <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">
                {exclusive.shared > 0
                  ? `${exclusive.shared} source${exclusive.shared === 1 ? '' : 's'} were found by both agents — the rest are unique to one side.`
                  : 'The two agents found no sources in common, which is itself worth noticing.'}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-success-700 dark:text-success-400">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Supporting the claim
                </p>
                {exclusive.pro.length ? (
                  <SourceLinkList links={exclusive.pro} label="Only this side" />
                ) : (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">
                    No sources unique to this side.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Against the claim
                </p>
                {exclusive.con.length ? (
                  <SourceLinkList links={exclusive.con} label="Only this side" />
                ) : (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">
                    No sources unique to this side.
                  </p>
                )}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
