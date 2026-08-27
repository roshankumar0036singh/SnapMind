'use client';

/**
 * The chat composer.
 *
 * Everything that changes how the next question is answered lives on this bar,
 * because that is the moment the choice matters: which sources are in scope
 * (pinned tray), whether saved bookmarks are searched too, how retrieval runs,
 * which persona speaks, and which language the answer comes back in. The
 * retrieval and language choices are read from SettingsContext so they persist
 * across sessions, and writing them back here means the Settings screen and this
 * bar never disagree.
 *
 * The three retrieval switches map to `use_reranking` / `use_graphrag` /
 * `use_query_enhancement` on the chat request. Each costs an extra model call or
 * two, which is why they are individually switchable rather than a single
 * "quality" dial.
 */

import { Spinner } from '@/components/dashboard/ui';
import { useSettings, OUTPUT_LANGUAGES } from '@/context/SettingsContext';
import { useCapture } from '@/context/CaptureContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import type { Persona } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  BookMarked,
  Check,
  ChevronDown,
  Languages,
  Paperclip,
  SlidersHorizontal,
  Square,
  Theater,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { PinnedTray } from './sources';

/* ------------------------------ small dropdown ----------------------------- */

function Menu({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
          active
            ? 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/30'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200',
        )}
      >
        {icon}
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1 shadow-theme-lg dark:border-white/10 dark:bg-dark-primary">
          <div className="custom-scrollbar max-h-64 overflow-y-auto">{children(() => setOpen(false))}</div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] transition',
        selected
          ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}

/** A switch inside a Menu — used for the retrieval knobs, which stack rather
 *  than being mutually exclusive, so MenuItem's single-selection look would lie. */
function MenuToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-primary-500' : 'bg-gray-200 dark:bg-white/15',
        )}
      >
        <span
          className={cn(
            'h-3 w-3 rounded-full bg-white shadow-theme-xs transition-transform',
            checked && 'translate-x-3',
          )}
        />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[12.5px] font-medium',
            checked ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300',
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-gray-400 dark:text-gray-500">
          {hint}
        </span>
      </span>
    </button>
  );
}

/* -------------------------------- composer -------------------------------- */
export default function Composer({
  onSend,
  onStop,
  streaming,
  suggestions = [],
  placeholder = 'Ask anything about your knowledge base…',
  autoFocus,
  initialValue,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  suggestions?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Seeds the box without sending. Used by the graph's "Ask about this entity"
   * handoff — prefilling rather than auto-sending leaves the question editable,
   * which matters because the caller guessed the phrasing, not the user.
   */
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Only ever *seeds*: a later arrival replaces an untouched box, never one the
  // user has started typing in.
  const seededRef = useRef(initialValue ?? '');
  useEffect(() => {
    if (!initialValue || initialValue === seededRef.current) return;
    seededRef.current = initialValue;
    setValue((v) => (v.trim() ? v : initialValue));
    ref.current?.focus();
  }, [initialValue]);

  const { prefs, setPrefs, setRetrieval } = useSettings();
  const { activeWorkspace } = useWorkspace();
  const { ingestFiles } = useCapture();

  const { data: personaData } = useApi<{ personas?: Persona[] } | Persona[]>(
    () => api.get('personas', { query: { workspace_id: activeWorkspace?.id } }),
    [activeWorkspace?.id],
  );
  const personas: Persona[] = Array.isArray(personaData) ? personaData : (personaData?.personas ?? []);
  const persona = personas.find((p) => p.id === prefs.personaId);
  const language = OUTPUT_LANGUAGES.find((l) => l.value === prefs.outputLang);

  // The three retrieval switches share one pill, so the label has to carry how
  // many are on — otherwise a closed menu says nothing about what will happen.
  const activeRetrieval = [
    prefs.retrieval.reranking,
    prefs.retrieval.graphRag,
    prefs.retrieval.queryEnhancement,
  ].filter(Boolean).length;
  const retrievalLabel = activeRetrieval ? `Retrieval · ${activeRetrieval}` : 'Retrieval';

  // Grow with the content, then scroll — capped so the transcript stays visible.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    setValue('');
    onSend(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void ingestFiles(files);
    e.target.value = '';
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-4 sm:px-6">
      {/* Follow-up chips — generated by POST /chat/suggest from the last answer. */}
      {!streaming && suggestions.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSend(s)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-[12px] font-medium text-gray-600 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10 dark:hover:text-primary-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-[26px] border border-gray-200 bg-white p-2 shadow-theme-md transition focus-within:border-primary-300 focus-within:shadow-ring dark:border-white/10 dark:bg-dark-primary dark:focus-within:border-primary-500/40">
        <textarea
          ref={ref}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          className="custom-scrollbar block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-[15px] leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500 min-h-[52px]"
        />

        <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
          <PinnedTray />

          <button
            type="button"
            onClick={() => setRetrieval({ queryNotebook: !prefs.retrieval.queryNotebook })}
            aria-pressed={prefs.retrieval.queryNotebook}
            title="Also search the notes and pages you saved to your notebook"
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
              prefs.retrieval.queryNotebook
                ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200',
            )}
          >
            <BookMarked className="h-3 w-3" />
            Notebook
          </button>

          <Menu
            label={retrievalLabel}
            icon={<SlidersHorizontal className="h-3 w-3" />}
            active={activeRetrieval > 0}
          >
            {() => (
              <>
                <MenuToggle
                  label="Rerank results"
                  hint="Scores the top candidates a second time and keeps the best. Slower, noticeably more accurate."
                  checked={prefs.retrieval.reranking}
                  onChange={() => setRetrieval({ reranking: !prefs.retrieval.reranking })}
                />
                <MenuToggle
                  label="Knowledge graph"
                  hint="Adds how the entities in your question relate to each other, on top of the matching passages."
                  checked={prefs.retrieval.graphRag}
                  onChange={() => setRetrieval({ graphRag: !prefs.retrieval.graphRag })}
                />
                <MenuToggle
                  label="Expand the question"
                  hint="Searches several rephrasings as well as your wording. Helps when you don't know the source's vocabulary."
                  checked={prefs.retrieval.queryEnhancement}
                  onChange={() =>
                    setRetrieval({ queryEnhancement: !prefs.retrieval.queryEnhancement })
                  }
                />
              </>
            )}
          </Menu>

          <Menu
            label={persona?.name ?? 'Default voice'}
            icon={<Theater className="h-3 w-3" />}
            active={Boolean(persona)}
          >
            {(close) => (
              <>
                <MenuItem
                  selected={!prefs.personaId}
                  onClick={() => {
                    setPrefs({ personaId: null });
                    close();
                  }}
                >
                  Default voice
                </MenuItem>
                {personas.map((p) => (
                  <MenuItem
                    key={p.id}
                    selected={p.id === prefs.personaId}
                    onClick={() => {
                      setPrefs({ personaId: p.id });
                      close();
                    }}
                  >
                    {p.name}
                  </MenuItem>
                ))}
                {!personas.length && (
                  <p className="px-2.5 py-2 text-[11.5px] text-gray-400 dark:text-gray-500">
                    Create a persona in Settings to change the assistant&apos;s tone.
                  </p>
                )}
              </>
            )}
          </Menu>

          <Menu
            label={prefs.outputLang === 'auto' ? 'Auto language' : (language?.label ?? prefs.outputLang)}
            icon={<Languages className="h-3 w-3" />}
            active={prefs.outputLang !== 'auto'}
          >
            {(close) =>
              OUTPUT_LANGUAGES.map((l) => (
                <MenuItem
                  key={l.value}
                  selected={l.value === prefs.outputLang}
                  onClick={() => {
                    setPrefs({ outputLang: l.value });
                    close();
                  }}
                >
                  {l.label}
                </MenuItem>
              ))
            }
          </Menu>

          <div className="ml-auto flex items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.csv,.txt,.md,.markdown"
              onChange={onFiles}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Add a file to your knowledge base"
              aria-label="Attach files"
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>

            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                aria-label="Send"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition',
                  value.trim()
                    ? 'button-bg text-white shadow-theme-xs hover:opacity-90'
                    : 'cursor-not-allowed bg-gray-100 text-gray-300 dark:bg-white/10 dark:text-gray-600',
                )}
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-400 dark:text-gray-500">
        {streaming ? (
          <>
            <Spinner className="h-3 w-3" /> Generating — every claim is cited back to a source.
          </>
        ) : (
          <>
            <kbd className="rounded border border-gray-200 px-1 font-sans dark:border-white/15">Enter</kbd> to send ·
            <kbd className="rounded border border-gray-200 px-1 font-sans dark:border-white/15">Shift</kbd>+
            <kbd className="rounded border border-gray-200 px-1 font-sans dark:border-white/15">Enter</kbd> for a new line
          </>
        )}
      </p>
    </div>
  );
}
