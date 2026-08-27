'use client';

import { IconButton, PANEL } from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { SOURCE_ACCENT } from '@/lib/format';
import type { IngestJob } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, ChevronDown, Loader2, X } from 'lucide-react';
import { useState } from 'react';

function JobRow({ job, onDismiss }: { job: IngestJob; onDismiss: (id: string) => void }) {
  const running = job.status === 'running' || job.status === 'queued';

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'w-7 h-7 shrink-0 rounded-lg flex items-center justify-center',
            job.status === 'error'
              ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-red-300'
              : job.status === 'done'
                ? 'bg-success-50 text-success-600 dark:bg-success-600/15 dark:text-emerald-300'
                : SOURCE_ACCENT[job.kind],
          )}
        >
          {job.status === 'error' ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : job.status === 'done' ? (
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          ) : (
            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{job.label}</p>
          {job.message && (
            <p
              className={cn(
                'text-[11px] truncate mt-0.5',
                job.status === 'error'
                  ? 'text-error-600 dark:text-red-300'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              {job.message}
            </p>
          )}
        </div>

        {!running && (
          <button
            onClick={() => onDismiss(job.id)}
            aria-label="Dismiss"
            className="text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 shrink-0 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {running && (
        <div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full dashboard-gradient transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${Math.max(4, job.progress ?? 4)}%` }}
          />
        </div>
      )}
    </li>
  );
}

/** Floating progress dock. Renders only while there is something to report. */
export default function CaptureQueue() {
  const { jobs, activeCount, clearFinished, dismiss } = useCapture();
  const [collapsed, setCollapsed] = useState(false);

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(22rem,calc(100vw-2.5rem))]">
      <div className={cn(PANEL, 'overflow-hidden shadow-theme-lg')}>
        <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/10">
          <span className="text-xs font-semibold text-gray-900 dark:text-white">
            {activeCount > 0
              ? `Indexing ${activeCount} item${activeCount === 1 ? '' : 's'}`
              : 'Capture queue'}
          </span>
          <span className="flex-1" />
          {activeCount === 0 && (
            <button
              onClick={clearFinished}
              className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              Clear
            </button>
          )}
          <IconButton
            icon={
              <ChevronDown
                className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')}
              />
            }
            label={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed((v) => !v)}
            className="w-7 h-7"
          />
        </header>

        {!collapsed && (
          <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-72 overflow-y-auto custom-scrollbar">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onDismiss={dismiss} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
