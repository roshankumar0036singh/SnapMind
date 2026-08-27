'use client';

/**
 * Progress for a research run — in two honest flavours.
 *
 * `StageList` is for Browser Mode, which is a *single blocking POST*
 * (research.py:37). Its orchestrator prints progress to the server's stdout and
 * exposes no channel to the client, so there is nothing to drive a live stage
 * tracker from. Animating one anyway would be inventing telemetry, so the stages
 * are shown as a static explanation of what is happening, with an elapsed clock
 * as the only real signal, and the panel says so.
 *
 * `HopTimeline` is for Deep Research, where the progress *is* real: the reasoning
 * chain yields a plan up front and then `processing`/`completed` events per hop
 * (reasoning_chain.py:129-171), streamed over the NDJSON route.
 */

import { Pill } from '@/components/dashboard/ui';
import { formatElapsed } from '@/lib/research';
import type { ReasoningPlanStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Check, Clock, Database, Globe, Info, Loader2, Sparkles } from 'lucide-react';

/* ---------------------------------- clock --------------------------------- */

export function RunClock({ elapsed, running }: { elapsed: number; running: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums',
        running
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
          : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
      )}
    >
      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
      {formatElapsed(elapsed)}
    </span>
  );
}

/* -------------------------------- stage list ------------------------------- */

export function StageList({
  stages,
  elapsed,
  running,
  onStop,
}: {
  stages: { name: string; detail: string }[];
  elapsed: number;
  running: boolean;
  onStop?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white/90">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-500" />
          The agent is working
        </span>
        <div className="flex items-center gap-2">
          <RunClock elapsed={elapsed} running={running} />
          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Stop waiting
            </button>
          )}
        </div>
      </div>

      <ol className="space-y-2">
        {stages.map((s, i) => (
          <li key={s.name} className="flex gap-2.5">
            <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold tabular-nums text-gray-500 dark:bg-white/10 dark:text-gray-400">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {s.name}
              </span>
              <span className="ml-1.5 text-[12px] text-gray-500 dark:text-gray-400">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 flex items-start gap-1.5 border-t border-gray-200/70 pt-2.5 text-[11.5px] leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400">
        <Info className="mt-[1px] h-3 w-3 shrink-0" />
        <span>
          Browser Mode returns everything at once, so these steps are what the agent
          does — not a live position. Use{' '}
          <span className="font-medium text-gray-600 dark:text-gray-300">Deep Research</span> when
          you want to watch each step land.
        </span>
      </p>
    </div>
  );
}

/* ------------------------------- hop timeline ------------------------------ */

export type HopStatus = 'pending' | 'processing' | 'completed';

function HopDot({ status }: { status: HopStatus }) {
  if (status === 'completed') {
    return (
      <span className="relative z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-success-600 text-white">
        <Check className="h-2 w-2" strokeWidth={3.5} />
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="relative z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-white ring-1 ring-primary-300 dark:bg-dark-primary dark:ring-primary-500/50">
        <Loader2 className="h-2.5 w-2.5 animate-spin text-primary-500" />
      </span>
    );
  }
  return (
    <span className="relative z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-dark-primary dark:ring-white/15">
      <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-white/30" />
    </span>
  );
}

const TOOL_META: Record<string, { label: string; icon: typeof Globe }> = {
  web_search: { label: 'Web search', icon: Globe },
  local_rag: { label: 'Your knowledge base', icon: Database },
};

export function HopTimeline({
  plan,
  statuses,
  synthesising,
  elapsed,
  running,
  onStop,
}: {
  plan: ReasoningPlanStep[];
  statuses: Record<number, HopStatus>;
  /** True once the final-synthesis thought has arrived. */
  synthesising: boolean;
  elapsed: number;
  running: boolean;
  onStop?: () => void;
}) {
  const planned = plan.length;

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
          {planned ? `Reasoning chain · ${planned} step${planned === 1 ? '' : 's'}` : 'Planning the chain…'}
        </span>
        <div className="flex items-center gap-2">
          <RunClock elapsed={elapsed} running={running} />
          {running && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Stop waiting
            </button>
          )}
        </div>
      </div>

      {!planned ? (
        <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
          Breaking your question into sub-questions. The plan appears here first, then each step
          reports as it finishes.
        </p>
      ) : (
        <ol className="relative space-y-3 pl-0">
          <span
            aria-hidden="true"
            className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200 dark:bg-white/10"
          />
          {plan.map((step, i) => {
            const num = step.step ?? i + 1;
            const status = statuses[num] ?? 'pending';
            const tool = TOOL_META[step.tool ?? 'web_search'] ?? TOOL_META.web_search;
            const ToolIcon = tool.icon;
            const deps = (step.depends_on ?? []).filter((d) => d !== num);

            return (
              <li key={`${num}-${i}`} className="flex gap-3">
                <HopDot status={status} />
                <div className="min-w-0 flex-1 -mt-[2px]">
                  <p
                    className={cn(
                      'text-[13px] font-medium',
                      status === 'pending'
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-900 dark:text-white/90',
                    )}
                  >
                    {step.question || `Step ${num}`}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <ToolIcon className="h-3 w-3" />
                      {tool.label}
                    </span>
                    {deps.length > 0 && (
                      <span>· needs step {deps.join(', ')}</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}

          <li className="flex gap-3">
            <HopDot status={synthesising ? (running ? 'processing' : 'completed') : 'pending'} />
            <div className="min-w-0 flex-1 -mt-[2px]">
              <p
                className={cn(
                  'text-[13px] font-medium',
                  synthesising
                    ? 'text-gray-900 dark:text-white/90'
                    : 'text-gray-400 dark:text-gray-500',
                )}
              >
                Synthesise the final answer
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                <Sparkles className="h-3 w-3" />
                Merges every step, keeping each step&apos;s citations
              </p>
            </div>
          </li>
        </ol>
      )}
    </div>
  );
}

/* -------------------------------- run notice ------------------------------- */

/** A short caveat above a mode's form — cost, latency, or a key requirement. */
export function ModeNotice({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 rounded-xl px-3 py-2 text-[11.5px] leading-relaxed',
        tone === 'warning'
          ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
          : 'bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400',
      )}
    >
      <Info className="mt-[1px] h-3 w-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Small labelled count, used under an answer. */
export function CountPill({ children }: { children: React.ReactNode }) {
  return <Pill tone="neutral">{children}</Pill>;
}
