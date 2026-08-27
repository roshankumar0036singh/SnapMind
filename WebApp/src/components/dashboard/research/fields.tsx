'use client';

/**
 * Form pieces shared by the research modes.
 *
 * Extracted for one behavioural reason rather than for tidiness: every mode here
 * starts a run that takes tens of seconds, so ⌘/Ctrl+Enter has to submit and a
 * plain Enter has to insert a newline — a research prompt is often two sentences.
 * Getting that consistent across seven forms is easier than getting it right
 * seven times.
 */

import { Button, FIELD } from '@/components/dashboard/ui';
import { cn } from '@/lib/utils';
import { Play, Square } from 'lucide-react';
import type { ReactNode } from 'react';

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 block">
      <span className="block text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
        {children}
      </span>
      {hint && (
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      )}
    </span>
  );
}

export function QueryField({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 3,
  autoFocus,
  disabled,
  label,
  hint,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <textarea
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={cn(FIELD, 'resize-y leading-relaxed')}
      />
    </label>
  );
}

export function TextField({
  value,
  onChange,
  onSubmit,
  placeholder,
  type = 'text',
  disabled,
  label,
  hint,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  type?: 'text' | 'url';
  disabled?: boolean;
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={FIELD}
      />
    </label>
  );
}

/**
 * Run / stop, in one control.
 *
 * "Stop waiting" rather than "Cancel" on purpose: aborting the fetch releases the
 * browser, but the backend orchestrator has no cancellation channel and keeps
 * going to completion. Labelling it "Cancel" would promise something the API
 * cannot deliver.
 */
export function RunButton({
  running,
  onRun,
  onStop,
  disabled,
  label = 'Run',
  runningLabel = 'Working…',
  className,
}: {
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  disabled?: boolean;
  label?: string;
  runningLabel?: string;
  className?: string;
}) {
  if (running) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button variant="primary" size="md" loading disabled>
          {runningLabel}
        </Button>
        <Button variant="ghost" size="md" onClick={onStop}>
          <Square className="h-3.5 w-3.5" />
          Stop waiting
        </Button>
      </div>
    );
  }

  return (
    <Button variant="gradient" size="md" onClick={onRun} disabled={disabled} className={className}>
      <Play className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
