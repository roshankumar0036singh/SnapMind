'use client';

import { Button, INSET, Segmented, Toggle } from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { SOURCE_ACCENT, SOURCE_LABELS, sourceKind } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  FileText,
  GitBranch,
  Link2,
  Notebook,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState, type DragEvent } from 'react';

type Tab = 'link' | 'files' | 'repo' | 'note';

const TABS = [
  { value: 'link' as const, label: 'Link', icon: <Link2 className="w-3.5 h-3.5" /> },
  { value: 'files' as const, label: 'Files', icon: <UploadCloud className="w-3.5 h-3.5" /> },
  { value: 'repo' as const, label: 'Repo', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { value: 'note' as const, label: 'Note', icon: <Notebook className="w-3.5 h-3.5" /> },
];

const ACCEPT = '.pdf,.docx,.doc,.csv,.txt,.md';

const FIELD =
  'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-dark-secondary border border-gray-200 dark:border-white/10 ' +
  'text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 ' +
  'outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition';

export default function CaptureForm({
  onDone,
  compact = false,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const { ingestUrl, ingestUrls, ingestText, ingestFiles, ingestRepo } = useCapture();
  const [tab, setTab] = useState<Tab>('link');
  const [busy, setBusy] = useState(false);

  // link
  const [url, setUrl] = useState('');
  const [multi, setMulti] = useState(false);
  const [maxPages, setMaxPages] = useState(20);
  const [maxDepth, setMaxDepth] = useState(2);
  const [bulk, setBulk] = useState('');
  const [bulkMode, setBulkMode] = useState(false);

  // files
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // repo
  const [repo, setRepo] = useState('');

  // note
  const [noteTitle, setNoteTitle] = useState('');
  const [note, setNote] = useState('');

  const addFiles = useCallback((incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...list.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  }, []);

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const canSubmit =
    (tab === 'link' && (bulkMode ? bulk.trim().length > 0 : url.trim().length > 0)) ||
    (tab === 'files' && files.length > 0) ||
    (tab === 'repo' && repo.trim().length > 0) ||
    (tab === 'note' && note.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      if (tab === 'link') {
        if (bulkMode) {
          const urls = bulk
            .split(/[\n,\s]+/)
            .map((u) => u.trim())
            .filter((u) => /^https?:\/\//i.test(u));
          await ingestUrls(urls);
          setBulk('');
        } else {
          await ingestUrl({
            url,
            crawlMode: multi ? 'crawl' : 'single',
            maxPages,
            maxDepth,
          });
          setUrl('');
        }
      } else if (tab === 'files') {
        await ingestFiles(files);
        setFiles([]);
      } else if (tab === 'repo') {
        await ingestRepo(repo);
        setRepo('');
      } else {
        await ingestText(note, noteTitle);
        setNote('');
        setNoteTitle('');
      }
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Segmented options={TABS} value={tab} onChange={(v) => setTab(v as Tab)} />

      {/* ------------------------------- link ------------------------------- */}
      {tab === 'link' && (
        <div className="space-y-4">
          {bulkMode ? (
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={compact ? 4 : 6}
              placeholder={'https://example.com/article\nhttps://youtube.com/watch?v=…\nhttps://x.com/user/status/…'}
              className={cn(FIELD, 'resize-none font-mono text-xs leading-relaxed')}
            />
          ) : (
            <div className="space-y-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="https://example.com/article, a YouTube link, an X thread, or a PDF URL"
                className={FIELD}
                autoFocus={compact}
              />
              {url.trim() && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  Detected as
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full font-medium',
                      SOURCE_ACCENT[sourceKind(url)],
                    )}
                  >
                    {SOURCE_LABELS[sourceKind(url)]}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setBulkMode((v) => !v)}
              className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline"
            >
              {bulkMode ? 'Add a single link instead' : 'Add several links at once'}
            </button>
          </div>

          {!bulkMode && (
            <div className={cn(INSET, 'p-4 space-y-4')}>
              <Toggle
                checked={multi}
                onChange={setMulti}
                label="Crawl the whole site"
                hint="Follow internal links instead of indexing just this page."
              />
              {multi && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="space-y-1.5">
                    <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Max pages
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxPages}
                      onChange={(e) =>
                        setMaxPages(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className={FIELD}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Max depth
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={maxDepth}
                      onChange={(e) =>
                        setMaxDepth(Math.min(3, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className={FIELD}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------- files ------------------------------ */}
      {tab === 'files' && (
        <div className="space-y-3">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center text-center cursor-pointer rounded-3xl border-2 border-dashed transition',
              compact ? 'py-8 px-5' : 'py-12 px-6',
              dragging
                ? 'border-primary-400 bg-primary-50/60 dark:border-primary-500/50 dark:bg-primary-500/10'
                : 'border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20',
            )}
          >
            <span className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-secondary shadow-theme-xs flex items-center justify-center mb-4">
              <UploadCloud className="w-5 h-5 text-primary-500" />
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Drop files here, or click to browse
            </span>
            <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              PDF, DOCX, CSV, TXT and Markdown
            </span>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>

          {files.length > 0 && (
            <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {files.map((f) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5"
                >
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">
                    {f.name}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                    aria-label={`Remove ${f.name}`}
                    className="text-gray-400 hover:text-error-500 transition shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------- repo ------------------------------- */}
      {tab === 'repo' && (
        <div className="space-y-3">
          <input
            type="url"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="https://github.com/owner/repository"
            className={FIELD}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The repository is cloned and indexed in the background. You can keep working — progress
            appears in the capture queue.
          </p>
        </div>
      )}

      {/* ------------------------------- note ------------------------------- */}
      {tab === 'note' && (
        <div className="space-y-3">
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title (optional)"
            className={FIELD}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={compact ? 5 : 9}
            placeholder="Paste or write anything — meeting notes, a transcript, an excerpt. It gets chunked, embedded and becomes searchable like any other source."
            className={cn(FIELD, 'resize-none leading-relaxed')}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onDone && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button variant="gradient" size="md" onClick={submit} disabled={!canSubmit} loading={busy}>
          <Sparkles className="w-4 h-4" />
          {tab === 'files' && files.length > 1 ? `Index ${files.length} files` : 'Add to library'}
        </Button>
      </div>
    </div>
  );
}
