'use client';

/**
 * Cross-lingual research — `POST research/cross_lingual`.
 *
 * The premise is that the best source on a subject is often not in your language.
 * The route translates your question into the search language, runs a browser
 * agent constrained to search in it, and synthesises the answer back into your
 * language (research.py:344-368).
 *
 * Two things the UI has to be straight about:
 *
 * 1. The `translated_query` is returned, and it is shown — the whole run hangs on
 *    that translation being right, and a reader who speaks the search language
 *    can spot a bad one instantly. Hiding it would hide the failure mode.
 * 2. The response carries `sources` only, which are *citations* (research.py:380),
 *    so the evidence is a link list. Sources will mostly be in the search
 *    language even though the answer is not.
 */

import { AnswerPanel } from '@/components/dashboard/research/answer';
import { QueryField, RunButton } from '@/components/dashboard/research/fields';
import { ModeNotice, StageList } from '@/components/dashboard/research/run-progress';
import { Button, ErrorNote, Panel, Select } from '@/components/dashboard/ui';
import { OUTPUT_LANGUAGES, useSettings } from '@/context/SettingsContext';
import { useAgentRun } from '@/hooks/use-agent-run';
import { api } from '@/lib/api-client';
import { PIPELINE_STAGES, SEARCH_LANGUAGES, sourceLinks } from '@/lib/research';
import type { CrossLingualResult } from '@/lib/types';
import { ArrowRight, Compass, Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

/**
 * `auto` is dropped from the target list here. The route defaults `target_lang`
 * to a real language and passes it straight to the synthesiser as prose
 * (research.py:331), so "match the question's language" has nothing to match
 * against — the question has already been translated away by then.
 */
const TARGETS = OUTPUT_LANGUAGES.filter((l) => l.value !== 'auto');

export default function LingualPanel({
  sessionId,
  initialQuery,
}: {
  sessionId: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { prefs } = useSettings();

  const [query, setQuery] = useState(initialQuery ?? '');
  const [searchLang, setSearchLang] = useState<string>('Mandarin Chinese');
  const [targetLang, setTargetLang] = useState<string>(
    prefs.outputLang === 'auto' ? 'English' : prefs.outputLang,
  );

  const run = useAgentRun<CrossLingualResult>();

  const start = () => {
    const q = query.trim();
    if (!q) return;
    void run.run((signal) =>
      api.post<CrossLingualResult>(
        'research/cross_lingual',
        {
          query: q,
          search_lang: searchLang,
          target_lang: targetLang,
          session_id: sessionId,
        },
        { signal },
      ),
    );
  };

  const links = useMemo(() => sourceLinks(run.result?.sources), [run.result?.sources]);

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <QueryField
          value={query}
          onChange={setQuery}
          onSubmit={start}
          autoFocus
          rows={2}
          label="Ask in your language"
          hint="Best on subjects where the primary sources are not in English — local regulation, regional industry reporting, domestic reaction. ⌘/Ctrl + Enter runs it."
          placeholder="e.g. How are Japanese manufacturers responding to the 2026 battery recycling quotas?"
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
              Search in
            </span>
            <Select
              label="Search language"
              value={searchLang}
              onChange={setSearchLang}
              options={SEARCH_LANGUAGES.map((l) => ({ value: l as string, label: l }))}
            />
          </label>

          <ArrowRight className="mb-3 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
              Answer in
            </span>
            <Select
              label="Answer language"
              value={targetLang}
              onChange={setTargetLang}
              options={TARGETS.map((l) => ({ value: l.value as string, label: l.label }))}
            />
          </label>

          <RunButton
            running={run.running}
            onRun={start}
            onStop={run.stop}
            disabled={!query.trim() || searchLang === targetLang}
            label="Search across the language barrier"
            runningLabel="Searching…"
            className="ml-auto"
          />
        </div>

        {searchLang === targetLang && (
          <p className="text-[11.5px] text-amber-700 dark:text-amber-400">
            Pick two different languages — searching and answering in the same one is just Browser
            Mode.
          </p>
        )}

        <ModeNotice>
          Your question is translated first, then a full browser agent searches in {searchLang} and
          the answer is written back in {targetLang}. Needs a Gemini or Mistral key; a Lingo.dev key
          improves the translation step.
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
          links={links}
          query={query.trim()}
          preamble={
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <Languages className="h-3 w-3" />
                Searched as
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-gray-800 dark:text-gray-100">
                {run.result.translated_query}
              </p>
              <p className="mt-1.5 text-[11.5px] text-gray-500 dark:text-gray-400">
                {run.result.search_lang ?? searchLang} → {run.result.target_lang ?? targetLang}. If
                that translation looks off, rephrase your question and run it again — everything
                downstream depends on it.
              </p>
            </div>
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
              Compare with a normal search
            </Button>
          }
          footnote={
            <>
              Sources are in {run.result.search_lang ?? searchLang} — the answer was translated, the
              pages behind it were not.
            </>
          }
        />
      )}
    </div>
  );
}
