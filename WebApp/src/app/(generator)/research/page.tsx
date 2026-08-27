'use client';

/**
 * Research — the whole `research` router on one screen.
 *
 * Seven routes, seven forms, and they are siblings rather than one query box
 * with a dropdown because their contracts genuinely differ: three take a
 * question, one takes a claim, one takes a URL, one takes a list of session ids,
 * and one takes a language pair. A single unified form would spend most of its
 * time greyed out, and would have to lie about what each mode supports.
 *
 * The active mode lives in `?mode=`, and `?q=` / `?session=` seed the forms — so
 * every state on this page is a link. That is what lets the panels hand off to
 * each other: a debate finishes and offers "Write this up", which is nothing
 * more than `/research?mode=report&session=<id>-pro,<id>-con&q=…`.
 *
 * One session id is minted per visit and shared by every mode. Whatever a run
 * ingests in the background lands under it, which is what lets the Report picker
 * offer "this research run" as evidence without anyone copying an id around.
 *
 * `PinnedSourcesProvider` wraps the panels because the answer renderer reuses
 * chat's `MessageSources`, and pinning a source is one of its affordances.
 * Outside the provider `usePinned()` is inert but safe; inside it, pins work.
 */

import { PinnedSourcesProvider } from '@/components/dashboard/chat/sources';
import { MODES, modeById, type ResearchModeId } from '@/components/dashboard/research/modes';
import BrowserPanel from '@/components/dashboard/research/panels/browser-panel';
import DebatePanel from '@/components/dashboard/research/panels/debate-panel';
import DeepPanel from '@/components/dashboard/research/panels/deep-panel';
import LingualPanel from '@/components/dashboard/research/panels/lingual-panel';
import PersonPanel from '@/components/dashboard/research/panels/person-panel';
import ReportPanel from '@/components/dashboard/research/panels/report-panel';
import ScrapePanel from '@/components/dashboard/research/panels/scrape-panel';
import { PageHeader, Pill, Spinner } from '@/components/dashboard/ui';
import { useWorkspace } from '@/context/WorkspaceContext';
import { uid } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Compass } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

function ResearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { activeWorkspace } = useWorkspace();

  const mode = modeById(params.get('mode'));
  const initialQuery = params.get('q') ?? undefined;

  /**
   * `?session=a,b` — plural because a debate ingests each side under its own
   * session, and a report of that debate wants both.
   */
  const raw = params.get('session');
  const handoffSessions = useMemo(
    () =>
      (raw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [raw],
  );

  /**
   * Minted once per visit, not once per run: every mode on this page ingests
   * under the same id so the Report picker can offer the visit as a whole.
   */
  const [sessionId] = useState(() => uid('research'));

  const workspaceId = activeWorkspace?.id;

  /** `replace`, not `push` — flicking through modes should not fill the back stack. */
  const select = (id: ResearchModeId) => {
    if (id === mode.id) return;
    const next = new URLSearchParams(params.toString());
    next.set('mode', id);
    router.replace(`/research?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<Compass className="h-6 w-6" />}
          accent="text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400"
          title="Research"
          description="Agents that go out to the live web, read what they find, and cite it. Every run indexes its sources, so anything researched here is answerable in chat afterwards."
          actions={<Pill tone="neutral">7 modes</Pill>}
        />

        {/* Mode strip. Scrolls sideways on narrow screens rather than wrapping, so
            the row never reflows the panel underneath it mid-run. */}
        <div>
          <div
            role="tablist"
            aria-label="Research mode"
            className="custom-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl bg-gray-50 p-1.5 dark:bg-white/[0.04]"
          >
            {MODES.map((m) => {
              const active = m.id === mode.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => select(m.id)}
                  title={m.blurb}
                  className={cn(
                    'group flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-[12.5px] font-medium transition',
                    active
                      ? 'border-gray-200 bg-white text-gray-900 shadow-theme-xs dark:border-white/15 dark:bg-white/10 dark:text-white'
                      : 'border-transparent text-gray-500 hover:bg-white/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-lg transition',
                      active
                        ? m.accent
                        : 'bg-gray-200/70 text-gray-400 group-hover:text-gray-600 dark:bg-white/10 dark:text-gray-500 dark:group-hover:text-gray-300',
                    )}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                  </span>
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 px-1 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            {mode.blurb}.
          </p>
        </div>

        {/* Keyed by mode so switching tabs starts the next mode clean instead of
            leaving a half-finished run's state behind it. */}
        <div role="tabpanel" aria-label={mode.label} key={mode.id}>
          {mode.id === 'browser' && (
            <BrowserPanel
              sessionId={sessionId}
              workspaceId={workspaceId}
              initialQuery={initialQuery}
            />
          )}
          {mode.id === 'deep' && <DeepPanel sessionId={sessionId} initialQuery={initialQuery} />}
          {mode.id === 'report' && (
            <ReportPanel initialQuery={initialQuery} handoffSessions={handoffSessions} />
          )}
          {mode.id === 'debate' && <DebatePanel sessionId={sessionId} initialQuery={initialQuery} />}
          {mode.id === 'person' && <PersonPanel sessionId={sessionId} initialQuery={initialQuery} />}
          {mode.id === 'lingual' && (
            <LingualPanel sessionId={sessionId} initialQuery={initialQuery} />
          )}
          {mode.id === 'scrape' && (
            <ScrapePanel
              sessionId={sessionId}
              workspaceId={workspaceId}
              initialQuery={initialQuery}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="h-6 w-6 text-primary-500" />
        </div>
      }
    >
      <PinnedSourcesProvider>
        <ResearchScreen />
      </PinnedSourcesProvider>
    </Suspense>
  );
}
