'use client';

/**
 * One turn in the transcript.
 *
 * Assistant turns carry three things the answer text alone doesn't: the
 * reasoning chain, the retrieved blocks the citations resolve against, and any
 * system notices the backend injected mid-stream (for example the "no answer on
 * this page, searching your knowledge base" fallback in search.py:149).
 */

import { IconButton } from '@/components/dashboard/ui';
import { relativeTime } from '@/lib/format';
import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  Copy,
  GitBranch,
  Info,
  Pencil,
  RefreshCw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Markdown from './markdown';
import ReasoningTimeline from './reasoning-timeline';
import { MessageSources } from './sources';

/* -------------------------------- user turn ------------------------------- */

function UserTurn({
  message,
  onEdit,
  disabled,
}: {
  message: ChatMessage;
  onEdit?: (id: string, text: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft.length]);

  const submit = () => {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== message.content) onEdit?.(message.id, text);
    else setDraft(message.content);
  };

  return (
    <div className="group flex justify-end gap-3">
      <div className="flex min-w-0 max-w-[46rem] flex-col items-end">
        {editing ? (
          <div className="w-full rounded-3xl rounded-br-lg border border-primary-200 bg-white p-2 shadow-theme-sm dark:border-primary-500/40 dark:bg-dark-primary">
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape') {
                  setDraft(message.content);
                  setEditing(false);
                }
              }}
              rows={Math.min(8, draft.split('\n').length + 1)}
              className="w-full resize-none bg-transparent px-2.5 py-1.5 text-[14.5px] text-gray-800 outline-none dark:text-gray-100"
            />
            <div className="flex justify-end gap-1 px-1 pb-0.5">
              <IconButton
                label="Cancel"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
              />
              <IconButton label="Ask again" icon={<Check className="h-3.5 w-3.5" />} onClick={submit} />
            </div>
          </div>
        ) : (
          <div className="button-bg max-w-full whitespace-pre-wrap break-words rounded-3xl rounded-br-lg px-4 py-2.5 text-[14.5px] leading-relaxed text-white shadow-theme-xs">
            {message.content}
          </div>
        )}

        {!editing && onEdit && (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <IconButton
              label="Edit and ask again"
              icon={<Pencil className="h-3 w-3" />}
              disabled={disabled}
              onClick={() => setEditing(true)}
            />
          </div>
        )}
      </div>

      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
        <User className="h-4 w-4" />
      </div>
    </div>
  );
}

/* ----------------------------- assistant turn ----------------------------- */

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400 motion-reduce:animate-none"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

function AssistantTurn({
  message,
  streaming,
  onRegenerate,
  onBranch,
}: {
  message: ChatMessage;
  streaming?: boolean;
  onRegenerate?: (id: string) => void;
  onBranch?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasText = Boolean(message.content.trim());
  const done = !streaming && hasText;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied — the text is still selectable */
    }
  };

  return (
    <div className="group flex gap-3">
      <div className="button-bg mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-theme-xs">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {message.systemNotes?.map((note, i) => (
          <p
            key={i}
            className="mb-2 flex items-start gap-2 rounded-xl bg-primary-50/70 px-3 py-2 text-[12.5px] text-primary-700 dark:bg-primary-500/10 dark:text-primary-300"
          >
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            {note}
          </p>
        ))}

        {message.thoughts?.length ? (
          <ReasoningTimeline steps={message.thoughts} streaming={streaming && !hasText} />
        ) : null}

        {hasText ? (
          <Markdown content={message.content} blocks={message.blocks} />
        ) : streaming ? (
          <TypingDots />
        ) : null}

        {message.error && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-error-100 bg-error-50 px-3 py-2 text-[12.5px] text-error-600 dark:border-error-500/25 dark:bg-error-500/10 dark:text-red-200">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            {message.error}
          </p>
        )}

        {message.blocks?.length ? <MessageSources blocks={message.blocks} /> : null}

        {done && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <IconButton
              label={copied ? 'Copied' : 'Copy answer'}
              icon={copied ? <Check className="h-3 w-3 text-success-600" /> : <Copy className="h-3 w-3" />}
              onClick={copy}
            />
            {onRegenerate && (
              <IconButton
                label="Regenerate"
                icon={<RefreshCw className="h-3 w-3" />}
                onClick={() => onRegenerate(message.id)}
              />
            )}
            {onBranch && (
              <IconButton
                label="Branch into a new chat from here"
                icon={<GitBranch className="h-3 w-3" />}
                onClick={() => onBranch(message.id)}
              />
            )}
            {message.metadata?.model && (
              <span className="ml-1 text-[10px] text-gray-300 dark:text-gray-600">
                {String(message.metadata.model)}
              </span>
            )}
            {message.createdAt && (
              <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600">
                {relativeTime(message.createdAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- entry --------------------------------- */

export default function Message({
  message,
  streaming,
  onRegenerate,
  onBranch,
  onEdit,
  className,
}: {
  message: ChatMessage;
  streaming?: boolean;
  onRegenerate?: (id: string) => void;
  onBranch?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  className?: string;
}) {
  if (message.role === 'system') {
    return (
      <p className={cn('text-center text-[12px] italic text-gray-400 dark:text-gray-500', className)}>
        {message.content}
      </p>
    );
  }

  return (
    <div className={className}>
      {message.role === 'user' ? (
        <UserTurn message={message} onEdit={onEdit} disabled={streaming} />
      ) : (
        <AssistantTurn
          message={message}
          streaming={streaming}
          onRegenerate={onRegenerate}
          onBranch={onBranch}
        />
      )}
    </div>
  );
}
