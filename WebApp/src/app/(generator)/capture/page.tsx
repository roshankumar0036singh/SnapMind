'use client';

import CaptureForm from '@/components/dashboard/capture/capture-form';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorNote,
  IconBadge,
  INSET,
  PageHeader,
  Panel,
  Pill,
  SectionHeader,
  Skeleton,
} from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import {
  SOURCE_ACCENT,
  SOURCE_LABELS,
  compactNumber,
  prettyUrl,
  relativeTime,
  sourceKind,
} from '@/lib/format';
import type { IngestJob, KeyStatus, Site, SourceKind } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Globe,
  KeyRound,
  Loader2,
  Sparkles,
  MessageCircle,
  Type,
  UploadCloud,
  X,
  Video,
} from 'lucide-react';
import Link from 'next/link';

/** The eight parsers the backend routes to, described in user terms. */
const SUPPORTED = [
  { icon: <Globe className="w-4 h-4" />, kind: 'web' as const, label: 'Web pages', hint: 'Single page or a whole site crawl' },
  { icon: <Video className="w-4 h-4" />, kind: 'youtube' as const, label: 'YouTube', hint: 'Transcript with timestamps' },
  { icon: <MessageCircle className="w-4 h-4" />, kind: 'twitter' as const, label: 'Twitter / X', hint: 'Threads and single posts' },
  { icon: <FileText className="w-4 h-4" />, kind: 'pdf' as const, label: 'PDF', hint: 'Page-accurate citations' },
  { icon: <FileText className="w-4 h-4" />, kind: 'docx' as const, label: 'Word', hint: '.doc and .docx' },
  { icon: <FileSpreadsheet className="w-4 h-4" />, kind: 'csv' as const, label: 'Spreadsheets', hint: 'CSV, row-aware chunking' },
  { icon: <GitBranch className="w-4 h-4" />, kind: 'github' as const, label: 'Repositories', hint: 'Code and markdown from a repo' },
  { icon: <Type className="w-4 h-4" />, kind: 'text' as const, label: 'Notes', hint: 'Paste anything as a text source' },
];

/** Explicit dot colors — Tailwind only emits classes it can see as literals. */
const KIND_DOT: Record<SourceKind, string> = {
  web: 'bg-primary-500',
  youtube: 'bg-red-500',
  twitter: 'bg-sky-500',
  pdf: 'bg-rose-500',
  docx: 'bg-blue-500',
  csv: 'bg-emerald-500',
  github: 'bg-gray-400',
  text: 'bg-violet-500',
  image: 'bg-amber-500',
};

export default function CapturePage() {
  const { jobs, activeCount, clearFinished, dismiss } = useCapture();

  const keys = useApi<KeyStatus>((signal) => api.get('status/keys', { signal }), []);
  const sites = useApi<{ sites: Site[] }>((signal) => api.get('sites', { signal }), []);

  const needsKeys = keys.data ? !keys.data.is_configured : false;
  const recent = (sites.data?.sites ?? []).slice(0, 8);
  const finished = jobs.filter((j) => j.status === 'done' || j.status === 'error').length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-6">
        <PageHeader
          icon={<UploadCloud className="w-6 h-6" />}
          title="Capture"
          description="Feed SnapMind anything you want it to remember. Drop files anywhere on this page, or paste a link."
          accent="text-sky-600 bg-sky-50 dark:bg-sky-500/10"
          actions={
            <ButtonLink href="/library" variant="outline" size="sm">
              View library
              <ArrowRight className="w-4 h-4" />
            </ButtonLink>
          }
        />

        {needsKeys && (
          <Panel className="border-amber-200/70 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/[0.07] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-4">
              <IconBadge
                icon={<KeyRound className="w-5 h-5" />}
                className="text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300"
              />
              <div className="flex-1 min-w-[15rem]">
                <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  Ingestion needs your provider keys
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                  Missing: {(keys.data?.missing_keys ?? []).join(', ') || 'unknown'}
                </p>
              </div>
              <ButtonLink href="/settings?tab=providers" variant="primary" size="sm">
                Add keys
              </ButtonLink>
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
          {/* Capture form */}
          <Panel className="lg:col-span-3">
            <SectionHeader
              title="Add a source"
              description="Everything lands in your active workspace"
            />
            <CaptureForm />
          </Panel>

          <div className="lg:col-span-2 space-y-5">
            {/* What it can read */}
            <Panel>
              <SectionHeader title="What SnapMind reads" />
              <ul className="space-y-2.5">
                {SUPPORTED.map((s) => (
                  <li key={s.label} className="flex items-center gap-3">
                    <IconBadge
                      size="sm"
                      icon={s.icon}
                      className={cn(SOURCE_ACCENT[s.kind], 'rounded-xl')}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        {s.label}
                      </span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">
                        {s.hint}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Recently indexed */}
            <Panel>
              <SectionHeader
                title="Recently indexed"
                action={
                  recent.length > 0 ? (
                    <Link
                      href="/library"
                      className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline"
                    >
                      All
                    </Link>
                  ) : undefined
                }
              />
              {sites.error ? (
                <ErrorNote message={sites.error} onRetry={sites.reload} />
              ) : sites.loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nothing indexed yet — your first capture shows up here.
                </p>
              ) : (
                <ul className="space-y-1 -mx-2">
                  {recent.map((s) => {
                    const k = sourceKind(s.url);
                    return (
                      <li key={s.url}>
                        <Link
                          href={`/library?source=${encodeURIComponent(s.url)}`}
                          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition"
                        >
                          <span className={cn('w-2 h-2 rounded-full shrink-0', KIND_DOT[k])} />
                          <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate">
                            {s.title && s.title !== s.url ? s.title : prettyUrl(s.url, 40)}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                            {s.chunk_count ? `${compactNumber(s.chunk_count)} ch` : SOURCE_LABELS[k]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        {/* This session's queue — full history, where the floating dock only shows a summary */}
        <Panel>
          <SectionHeader
            title="This session"
            description={
              activeCount > 0
                ? `${activeCount} ${activeCount === 1 ? 'job' : 'jobs'} in progress`
                : 'Ingestion jobs started since you opened this tab'
            }
            action={
              finished > 0 ? (
                <Button variant="ghost" size="sm" onClick={clearFinished}>
                  Clear finished
                </Button>
              ) : undefined
            }
          />
          {jobs.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-7 h-7" />}
              title="No jobs yet"
              description="Start a capture above and watch its progress here, chunk by chunk."
              className="py-10"
            />
          ) : (
            <ul className="space-y-2">
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} onDismiss={() => dismiss(j.id)} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function JobRow({ job, onDismiss }: { job: IngestJob; onDismiss: () => void }) {
  const done = job.status === 'done';
  const failed = job.status === 'error';
  const running = job.status === 'running' || job.status === 'queued';

  return (
    <li className={cn(INSET, 'px-4 py-3')}>
      <div className="flex items-center gap-3">
        <span className="shrink-0">
          {done ? (
            <CheckCircle2 className="w-4 h-4 text-success-600" />
          ) : failed ? (
            <AlertTriangle className="w-4 h-4 text-error-500" />
          ) : (
            <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">
              {job.label}
            </span>
            <Pill tone="neutral" className="shrink-0">
              {SOURCE_LABELS[job.kind]}
            </Pill>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
            {job.message ||
              (done
                ? job.chunks
                  ? `${compactNumber(job.chunks)} chunks indexed`
                  : 'Indexed'
                : failed
                  ? 'Failed'
                  : 'Working…')}
          </p>

          {running && (
            <div
              className="mt-2 h-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={job.progress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${job.label} progress`}
            >
              <div
                className="h-full dashboard-gradient rounded-full transition-all duration-500"
                style={{ width: `${Math.max(6, Math.min(100, job.progress ?? 8))}%` }}
              />
            </div>
          )}
        </div>

        <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 hidden sm:block">
          {relativeTime(job.finishedAt ?? job.startedAt)}
        </span>

        {!running && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss ${job.label}`}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}
