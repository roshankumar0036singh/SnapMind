'use client';

/**
 * Vision.
 *
 * `POST vision/analyze-image` takes exactly one image per call and returns
 * `{success, answer, model_used}` (api/v1/endpoints/vision.py:9). Two consequences
 * shape this screen:
 *
 *  - Multi-image means one request per shot, so shots are a filmstrip and each
 *    keeps its own thread of results rather than being merged into one answer.
 *  - `mode` picks the system prompt server-side (vision.py:53): `qa` answers a
 *    question, `extraction` transcribes the image as Markdown. They are different
 *    enough that they are a visible mode switch, not a hidden heuristic.
 *
 * History is local. `POST vision/cache` is an ephemeral in-memory image handoff
 * for the extension (a 50-entry OrderedDict, vision.py:49) — it is not a store,
 * so persisting recents here means localStorage, and only thumbnails go in it.
 */

import CropStage from '@/components/dashboard/vision/crop-stage';
import Markdown from '@/components/dashboard/chat/markdown';
import {
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  PANEL,
  Pill,
  SectionHeader,
  Segmented,
  Select,
  Spinner,
} from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { OUTPUT_LANGUAGES, useSettings } from '@/context/SettingsContext';
import { api, ApiError } from '@/lib/api-client';
import { relativeTime, uid } from '@/lib/format';
import { fileToDataUrl, isImageFile, thumbnail } from '@/lib/image';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  ClipboardPaste,
  Copy,
  Database,
  Image as ImageIcon,
  Languages,
  MessageSquare,
  Plus,
  ScanText,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

/* ---------------------------------- types --------------------------------- */

type Mode = 'qa' | 'extraction';

type Shot = { id: string; name: string; dataUrl: string };

type Analysis = {
  id: string;
  shotId: string;
  mode: Mode;
  prompt: string;
  answer: string;
  model?: string;
  at: string;
  ingested?: boolean;
};

type HistoryEntry = {
  id: string;
  at: string;
  name: string;
  mode: Mode;
  prompt: string;
  answer: string;
  thumb: string;
};

const HISTORY_KEY = 'snapmind.vision.history';
const HISTORY_MAX = 20;

const MODES: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'qa', label: 'Ask', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { value: 'extraction', label: 'Extract text', icon: <ScanText className="h-3.5 w-3.5" /> },
];

const QA_IDEAS = [
  'What is this chart telling me?',
  'Summarise this screenshot in three bullets.',
  'Transcribe the table and explain the outlier.',
  'What does this error mean and how do I fix it?',
];

/* --------------------------------- history -------------------------------- */

function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {
    /* quota — recents are a convenience, the analysis itself is already on screen */
  }
}

/* ----------------------------------- page --------------------------------- */

export default function VisionPage() {
  const { prefs } = useSettings();
  const { ingestText } = useCapture();

  const [shots, setShots] = useState<Shot[]>([]);
  const [activeShot, setActiveShot] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [mode, setMode] = useState<Mode>('qa');
  const [prompt, setPrompt] = useState('');
  const [lang, setLang] = useState<string>(prefs.outputLang ?? 'auto');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const shot = shots.find((s) => s.id === activeShot) ?? null;
  const shotAnalyses = useMemo(
    () => analyses.filter((a) => a.shotId === activeShot),
    [analyses, activeShot],
  );

  useEffect(() => setHistory(readHistory()), []);

  /* ------------------------------- adding shots ----------------------------- */

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter(isImageFile);
    if (!images.length) {
      if (files.length) toast.error('That file is not an image');
      return;
    }
    const next: Shot[] = [];
    for (const file of images) {
      try {
        next.push({
          id: uid('shot'),
          name: file.name || 'Pasted image',
          dataUrl: await fileToDataUrl(file),
        });
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }
    if (!next.length) return;
    setShots((prev) => [...prev, ...next]);
    setActiveShot((prev) => prev ?? next[0].id);
    setError(null);
  }, []);

  // Paste-to-analyse. Ignored while typing in the prompt so ⌘V still pastes text.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some(isImageFile)) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const removeShot = (id: string) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
    setAnalyses((prev) => prev.filter((a) => a.shotId !== id));
    setActiveShot((prev) => (prev === id ? (shots.find((s) => s.id !== id)?.id ?? null) : prev));
  };

  /** A crop lands as its own shot so the original stays available. */
  const onCrop = (dataUrl: string) => {
    const id = uid('shot');
    setShots((prev) => [...prev, { id, name: `${shot?.name ?? 'Image'} · region`, dataUrl }]);
    setActiveShot(id);
    toast.success('Region added as a new image');
  };

  /* --------------------------------- analyse -------------------------------- */

  const analyse = async (question: string) => {
    if (!shot || running) return;
    const asked = mode === 'extraction' ? '' : question.trim();
    if (mode === 'qa' && !asked) {
      toast.error('Ask something about the image first');
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const res = await api.post<{ success?: boolean; answer?: string; model_used?: string }>(
        'vision/analyze-image',
        {
          image_data: shot.dataUrl,
          prompt: asked || null,
          mode,
          target_lang: lang,
          // The backend uses this only to sharpen the system prompt
          // (vision.py:42) — it tells the model what it is looking at.
          active_context: { type: 'file', id: shot.id, name: shot.name },
        },
      );

      const answer = (res?.answer ?? '').trim();
      if (!answer) throw new Error('The vision model returned nothing.');

      const entry: Analysis = {
        id: uid('vz'),
        shotId: shot.id,
        mode,
        prompt: asked,
        answer,
        model: res?.model_used,
        at: new Date().toISOString(),
      };
      setAnalyses((prev) => [...prev, entry]);
      setPrompt('');

      const thumb = await thumbnail(shot.dataUrl);
      setHistory((prev) => {
        const next = [
          { id: entry.id, at: entry.at, name: shot.name, mode, prompt: asked, answer, thumb },
          ...prev,
        ].slice(0, HISTORY_MAX);
        writeHistory(next);
        return next;
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : ((err as Error)?.message ?? 'The vision model could not be reached.');
      setError(message);
    } finally {
      setRunning(false);
    }
  };

  /* --------------------------------- actions -------------------------------- */

  const ingest = async (entry: Analysis) => {
    const title =
      entry.mode === 'extraction'
        ? `OCR · ${shots.find((s) => s.id === entry.shotId)?.name ?? 'image'}`
        : `Vision · ${entry.prompt.slice(0, 60)}`;
    const ok = await ingestText(entry.answer, title);
    if (ok) {
      setAnalyses((prev) => prev.map((a) => (a.id === entry.id ? { ...a, ingested: true } : a)));
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Clipboard is blocked in this browser');
    }
  };

  const clearHistory = () => {
    setHistory([]);
    writeHistory([]);
  };

  /* ---------------------------------- view --------------------------------- */

  return (
    <div
      className="custom-scrollbar flex-1 overflow-y-auto"
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDropping(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        void addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon={<ImageIcon className="h-6 w-6" />}
          accent="text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400"
          title="Vision"
          description="Read screenshots, charts, diagrams, and scanned pages — then keep what matters."
          actions={
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Plus className="h-3.5 w-3.5" />
                Add images
              </Button>
            </div>
          }
        />

        {!shots.length ? (
          <Panel padded={false}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-16 transition',
                dropping
                  ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/60 dark:bg-amber-500/10'
                  : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40 dark:border-white/15 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5',
              )}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
                <UploadCloud className="h-8 w-8" />
              </span>
              <span className="text-center">
                <span className="block text-[15px] font-semibold text-gray-900 dark:text-white">
                  Drop an image, paste from the clipboard, or browse
                </span>
                <span className="mt-1 block text-[12.5px] text-gray-500 dark:text-gray-400">
                  PNG, JPG, WEBP, GIF · screenshots work best
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                <ClipboardPaste className="h-3 w-3" />
                <kbd className="font-sans">Ctrl</kbd>+<kbd className="font-sans">V</kbd> anywhere on this page
              </span>
            </button>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ------------------------------ the stage ----------------------------- */}
            <div className="space-y-3">
              <Panel className="flex flex-col items-center">
                {shot && (
                  <CropStage
                    key={shot.id}
                    src={shot.dataUrl}
                    alt={shot.name}
                    onCrop={onCrop}
                    onClear={() => removeShot(shot.id)}
                  />
                )}
              </Panel>

              {shots.length > 1 && (
                <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {shots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveShot(s.id)}
                      title={s.name}
                      className={cn(
                        'relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition',
                        s.id === activeShot
                          ? 'border-amber-400'
                          : 'border-transparent opacity-70 hover:opacity-100',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.dataUrl} alt={s.name} className="h-full w-full object-cover" />
                      {analyses.some((a) => a.shotId === s.id) && (
                        <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                          {analyses.filter((a) => a.shotId === s.id).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
                {shot?.name}
              </p>
            </div>

            {/* ----------------------------- the analysis ---------------------------- */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented options={MODES} value={mode} onChange={setMode} />
                <div className="ml-auto flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5 text-gray-400" />
                  <Select
                    label="Answer language"
                    value={lang}
                    onChange={setLang}
                    options={OUTPUT_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                  />
                </div>
              </div>

              <div className={cn(PANEL, 'flex min-h-[18rem] flex-1 flex-col p-4')}>
                {!shotAnalyses.length && !running && !error && (
                  <EmptyState
                    icon={<Sparkles className="h-6 w-6" />}
                    title={mode === 'extraction' ? 'Ready to transcribe' : 'Ask about this image'}
                    description={
                      mode === 'extraction'
                        ? 'Extract every visible word as structured Markdown, ready to save.'
                        : 'Answers come only from what is visible in the image.'
                    }
                    className="!py-10"
                  />
                )}

                <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto">
                  {shotAnalyses.map((entry) => (
                    <article key={entry.id} className="space-y-2">
                      <header className="flex items-center gap-2">
                        <Pill tone={entry.mode === 'extraction' ? 'warning' : 'brand'}>
                          {entry.mode === 'extraction' ? 'Extracted text' : 'Answer'}
                        </Pill>
                        {entry.prompt && (
                          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-500 dark:text-gray-400">
                            {entry.prompt}
                          </p>
                        )}
                        <span className="shrink-0 text-[10px] text-gray-300 dark:text-gray-600">
                          {entry.model}
                        </span>
                      </header>

                      <Markdown content={entry.answer} />

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <IconButton
                          label="Copy"
                          icon={<Copy className="h-3 w-3" />}
                          onClick={() => void copy(entry.answer)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void ingest(entry)}
                          disabled={entry.ingested}
                          className="!px-2 !text-[11px]"
                        >
                          <Database className="h-3 w-3" />
                          {entry.ingested ? 'Saved to library' : 'Save to knowledge base'}
                        </Button>
                      </div>
                    </article>
                  ))}

                  {running && (
                    <p className="flex items-center gap-2 text-[12.5px] text-gray-500 dark:text-gray-400">
                      <Spinner className="h-3.5 w-3.5" />
                      {mode === 'extraction' ? 'Transcribing the image…' : 'Reading the image…'}
                    </p>
                  )}

                  {error && (
                    <p className="rounded-xl border border-error-100 bg-error-50 px-3 py-2 text-[12.5px] text-error-600 dark:border-error-500/25 dark:bg-error-500/10 dark:text-red-200">
                      {error}
                    </p>
                  )}
                </div>
              </div>

              {/* --------------------------------- ask --------------------------------- */}
              {mode === 'qa' ? (
                <div className="space-y-2">
                  {!shotAnalyses.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {QA_IDEAS.map((idea) => (
                        <button
                          key={idea}
                          type="button"
                          onClick={() => setPrompt(idea)}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11.5px] text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void analyse(prompt)}
                      placeholder="Ask a question about this image…"
                      disabled={running}
                      className="w-full rounded-full border border-gray-200 bg-white py-3 pl-5 pr-12 text-[14px] text-gray-800 outline-none transition focus:border-amber-300 focus:shadow-ring disabled:opacity-60 dark:border-white/10 dark:bg-dark-primary dark:text-gray-100 dark:focus:border-amber-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => void analyse(prompt)}
                      disabled={running || !prompt.trim()}
                      aria-label="Analyse"
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {running ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => void analyse('')}
                  loading={running}
                  disabled={running}
                  className="w-full !bg-amber-500 hover:!bg-amber-600"
                >
                  <ScanText className="h-4 w-4" />
                  Extract all text from this image
                </Button>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------- recents -------------------------------- */}
        {history.length > 0 && (
          <section>
            <SectionHeader
              title="Recent analyses"
              description="Kept in this browser only — thumbnails, not full images."
              action={
                <Button variant="ghost" size="sm" onClick={clearHistory}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              }
            />
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {history.map((h) => (
                <article
                  key={h.id}
                  className={cn(PANEL, 'flex gap-3 p-3 transition hover:shadow-theme-sm')}
                >
                  {h.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.thumb}
                      alt={h.name}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Pill tone={h.mode === 'extraction' ? 'warning' : 'brand'}>
                        {h.mode === 'extraction' ? 'OCR' : 'Q&A'}
                      </Pill>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {relativeTime(h.at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">
                      {h.prompt || h.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
                      {h.answer}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void copy(h.answer)}
                        className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                      >
                        <Copy className="h-2.5 w-2.5" /> Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void ingestText(
                            h.answer,
                            h.mode === 'extraction' ? `OCR · ${h.name}` : `Vision · ${h.prompt}`,
                          );
                        }}
                        className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                      >
                        <ArrowRight className="h-2.5 w-2.5" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHistory((prev) => {
                            const next = prev.filter((x) => x.id !== h.id);
                            writeHistory(next);
                            return next;
                          })
                        }
                        className="ml-auto rounded-full p-0.5 text-gray-300 transition hover:bg-gray-100 hover:text-error-600 dark:text-gray-600 dark:hover:bg-white/10"
                        aria-label="Remove from recents"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-amber-500/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-amber-400 bg-white px-8 py-6 shadow-theme-lg dark:bg-dark-primary">
            <UploadCloud className="h-7 w-7 text-amber-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Drop to analyse</p>
          </div>
        </div>
      )}
    </div>
  );
}
