'use client';

/**
 * Report Generator — `POST research/generate_report`.
 *
 * The one mode whose output is a file, and the one with a third outcome besides
 * success and failure: **202 pending**. `session_ids` are matched against
 * `documents.metadata->>'session_id'` (report_generator.py:33), so if the
 * generator runs before the browser agent's background ingestion has landed it
 * finds nothing and returns `{status: "pending"}` rather than an empty paper.
 * `api.blob` treats a 202 as a success — it is one — so the JSON body arrives as
 * a blob and has to be sniffed by content type. Getting that wrong would download
 * a 90-byte "report".
 *
 * Sessions here are *ingestion* sessions, not conversations. A chat session id and
 * a research run id are the same kind of key, which is why both are offered.
 */

import { QueryField, RunButton, TextField } from '@/components/dashboard/research/fields';
import { ModeNotice, RunClock } from '@/components/dashboard/research/run-progress';
import {
  Button,
  Checkbox,
  ErrorNote,
  Panel,
  Pill,
  Select,
  Spinner,
} from '@/components/dashboard/ui';
import { OUTPUT_LANGUAGES, useSettings } from '@/context/SettingsContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAgentRun } from '@/hooks/use-agent-run';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import { downloadBlob, relativeTime } from '@/lib/format';
import { REPORT_OUTLINE } from '@/lib/research';
import type { ChatSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock3, Download, FileText, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

type ReportOutcome =
  | { kind: 'file'; filename: string }
  | { kind: 'pending'; message: string };

/** The report route's 202 body (research.py:73). */
function isPendingBlob(blob: Blob) {
  return /json/i.test(blob.type);
}

export default function ReportPanel({
  initialQuery,
  /**
   * Research runs whose sources should be offered first — from `?session=`.
   * A list rather than a single id because a debate ingests under two sessions
   * (`…-pro` and `…-con`), and a report of that debate wants both.
   */
  handoffSessions = [],
}: {
  initialQuery?: string;
  handoffSessions?: string[];
}) {
  const { prefs } = useSettings();
  const { activeWorkspace } = useWorkspace();

  const [query, setQuery] = useState(initialQuery ?? '');
  const [lang, setLang] = useState<string>(prefs.outputLang);
  const [scopeWorkspace, setScopeWorkspace] = useState(false);
  const [extraId, setExtraId] = useState('');
  const [selected, setSelected] = useState<string[]>(handoffSessions);

  const run = useAgentRun<ReportOutcome>();

  const sessions = useApi<ChatSession[]>((signal) => api.get('chat/sessions', { signal }), []);

  /**
   * Handoff sessions are prepended by hand: a research run writes documents but no
   * `chat_sessions` row, so `GET chat/sessions` will never list one even though it
   * is exactly the session the reader wants a report from.
   */
  const options = useMemo(() => {
    const rows = sessions.data ?? [];
    const out: { id: string; title: string; when?: string; synthetic?: boolean }[] = [];
    for (const id of handoffSessions) {
      if (rows.some((r) => r.session_id === id)) continue;
      out.push({
        id,
        title: id.endsWith('-pro')
          ? 'This debate — supporting side'
          : id.endsWith('-con')
            ? 'This debate — opposing side'
            : 'This research run',
        synthetic: true,
      });
    }
    for (const r of rows) {
      out.push({
        id: r.session_id,
        title: r.title?.trim() || r.session_id,
        when: r.updated_at ?? r.created_at ?? undefined,
      });
    }
    return out;
  }, [sessions.data, handoffSessions]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const addExtra = () => {
    const id = extraId.trim();
    if (!id) return;
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setExtraId('');
  };

  const canRun = !!query.trim() && selected.length > 0;

  const start = () => {
    if (!canRun) return;
    void run.run(async (signal) => {
      const blob = await api.blob(
        'research/generate_report',
        {
          session_ids: selected,
          query: query.trim(),
          workspace_id: scopeWorkspace ? (activeWorkspace?.id ?? null) : null,
          output_lang: lang,
        },
        { signal },
      );

      if (isPendingBlob(blob)) {
        const text = await blob.text();
        let message = 'The sources for these sessions are still being indexed.';
        try {
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          /* keep the default wording */
        }
        return { kind: 'pending', message } satisfies ReportOutcome;
      }

      const filename = `Research_Report_${selected[0]}.docx`;
      downloadBlob(blob, filename);
      return { kind: 'file', filename } satisfies ReportOutcome;
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <Panel className="space-y-4">
          <QueryField
            value={query}
            onChange={setQuery}
            onSubmit={start}
            rows={2}
            label="What is the paper about?"
            hint="The topic the report is written around. It steers the synthesis; the evidence comes from the sessions you pick."
            placeholder="e.g. Compliance obligations for open-weight model providers under the 2026 EU AI rules"
          />

          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
              Evidence sessions
            </span>
            <p className="mb-2.5 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
              Every page ingested under a selected session becomes evidence, along with any notebook
              highlights saved from it. Pick more than one to write across runs.
            </p>

            {sessions.loading ? (
              <div className="flex items-center gap-2 px-1 py-6 text-[12.5px] text-gray-500 dark:text-gray-400">
                <Spinner className="h-3.5 w-3.5" />
                Loading your sessions…
              </div>
            ) : sessions.error ? (
              <ErrorNote message={sessions.error} onRetry={sessions.reload} />
            ) : options.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-[12.5px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
                No sessions yet. Run Browser Mode first, or paste a session id below.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {options.map((o) => {
                  const checked = selected.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition',
                          checked
                            ? 'border-primary-200 bg-primary-50/60 dark:border-primary-500/40 dark:bg-primary-500/10'
                            : 'border-gray-100 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5',
                        )}
                      >
                        <Checkbox checked={checked} onChange={() => toggle(o.id)} label={o.title} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-gray-800 dark:text-gray-100">
                            {o.title}
                          </span>
                          <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                            {o.when ? relativeTime(o.when) : o.id}
                          </span>
                        </span>
                        {o.synthetic && <Pill tone="brand">current</Pill>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-2.5 flex items-end gap-2">
              <TextField
                value={extraId}
                onChange={setExtraId}
                onSubmit={addExtra}
                placeholder="Paste a session id"
                className="flex-1"
              />
              <Button variant="outline" size="md" onClick={addExtra} disabled={!extraId.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-gray-100 pt-4 dark:border-white/10">
            <div className="space-y-2.5">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
                  Written in
                </span>
                <Select
                  label="Report language"
                  value={lang}
                  onChange={setLang}
                  options={OUTPUT_LANGUAGES.map((l) => ({
                    value: l.value as string,
                    label: l.label,
                  }))}
                />
              </label>
              {activeWorkspace && (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                  <Checkbox
                    checked={scopeWorkspace}
                    onChange={setScopeWorkspace}
                    label={`Restrict to ${activeWorkspace.name}`}
                  />
                  Only use evidence in{' '}
                  <span className="font-medium">{activeWorkspace.name}</span>
                </label>
              )}
            </div>
            <RunButton
              running={run.running}
              onRun={start}
              onStop={run.stop}
              disabled={!canRun}
              label="Write the report"
              runningLabel="Writing…"
            />
          </div>

          <ModeNotice>
            Synthesis reads up to 50 evidence chunks plus the entity graph in one pass, so a report
            takes a few minutes and needs a Mistral or Gemini key. The DOCX downloads when it is
            done.
          </ModeNotice>
        </Panel>

        {run.running && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <span className="flex items-center gap-2 text-[13px] font-medium text-gray-700 dark:text-gray-200">
              <Spinner className="h-3.5 w-3.5" />
              Writing {selected.length} session{selected.length === 1 ? '' : 's'} into a paper
            </span>
            <div className="flex items-center gap-2">
              <RunClock elapsed={run.elapsed} running />
              <button
                type="button"
                onClick={run.stop}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Stop waiting
              </button>
            </div>
          </div>
        )}

        {run.error && <ErrorNote message={run.error} onRetry={start} />}

        {run.result?.kind === 'pending' && (
          <Panel className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock3 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Nothing to write from yet
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                {run.result.message} Sources are indexed in the background after a research run, so
                give it a minute and try again — or check the session ids are the ones that did the
                research.
              </p>
              <Button variant="soft" size="sm" className="mt-3" onClick={start}>
                Try again
              </Button>
            </div>
          </Panel>
        )}

        {run.result?.kind === 'file' && (
          <Panel className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Report downloaded
              </h3>
              <p className="mt-1 break-all text-[13px] text-gray-600 dark:text-gray-300">
                {run.result.filename}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={start}>
                <Download className="h-3.5 w-3.5" />
                Generate again
              </Button>
            </div>
          </Panel>
        )}
      </div>

      {/* Outline preview — copied from the generator's own prompt, so what is
          promised here is what the file contains. */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Panel className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white/90">
                What you get
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                A formal DOCX, nine sections
              </p>
            </div>
          </div>
          <ol className="space-y-1.5">
            {REPORT_OUTLINE.map((section, i) => (
              <li key={section} className="flex gap-2.5 text-[12.5px]">
                <span className="w-3.5 shrink-0 text-right tabular-nums text-gray-400 dark:text-gray-500">
                  {i + 1}
                </span>
                <span className="text-gray-700 dark:text-gray-200">{section}</span>
              </li>
            ))}
          </ol>
          <p className="border-t border-gray-100 pt-2.5 text-[11.5px] leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400">
            It is written as a systematic research paper, not a summary — expect formal prose and
            inline source attribution.
          </p>
        </Panel>
      </aside>
    </div>
  );
}
