'use client';

/**
 * The agent's reasoning chain, collapsed by default.
 *
 * `thought` events stream in ahead of the answer (services/search_service.py:87),
 * so this doubles as the "working…" indicator: while the answer is still empty
 * the latest step is shown inline instead of a bare spinner.
 */

import type { ThoughtStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Brain, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

function StatusDot({ status, active }: { status?: string; active: boolean }) {
  const done = status === 'done' || status === 'complete' || status === 'success';
  if (active && !done) {
    return (
      <span className="relative z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-white ring-1 ring-primary-300 dark:bg-dark-primary dark:ring-primary-500/50">
        <Loader2 className="h-2.5 w-2.5 animate-spin text-primary-500" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'relative z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full',
        done
          ? 'bg-success-600 text-white'
          : 'bg-white ring-1 ring-gray-200 dark:bg-dark-primary dark:ring-white/15',
      )}
    >
      {done ? <Check className="h-2 w-2" strokeWidth={3.5} /> : <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-white/30" />}
    </span>
  );
}

export default function ReasoningTimeline({
  steps,
  streaming = false,
  defaultOpen = false,
}: {
  steps: ThoughtStep[];
  /** True while the answer is still arriving — keeps the latest step visible. */
  streaming?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!steps.length) return null;

  const latest = steps[steps.length - 1];

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/70 dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-100/70 dark:hover:bg-white/[0.06]"
      >
        <Brain className={cn('h-3.5 w-3.5 shrink-0', streaming ? 'animate-pulse text-primary-500' : 'text-gray-400')} />
        <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">
          {streaming ? 'Reasoning' : `Reasoning · ${steps.length} step${steps.length === 1 ? '' : 's'}`}
        </span>
        {!open && streaming && latest?.thought && (
          <span className="min-w-0 flex-1 truncate text-[12px] text-gray-400 dark:text-gray-500">
            {latest.thought}
          </span>
        )}
        <ChevronDown
          className={cn('ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ol className="timeline-rail relative space-y-2.5 px-3 pb-3 pt-1">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <StatusDot status={step.status} active={streaming && i === steps.length - 1} />
              <div className="min-w-0 flex-1 pt-px">
                {step.action && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                    {step.action.replace(/_/g, ' ')}
                  </p>
                )}
                <p className="text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
                  {step.thought ?? '—'}
                </p>
              </div>
              {typeof step.step === 'number' && (
                <span className="shrink-0 font-mono text-[10px] text-gray-300 dark:text-gray-600">
                  {step.step}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
