'use client';

import { api, streamNDJSON, subscribeSSE } from '@/lib/api-client';
import { sourceKind, uid } from '@/lib/format';
import type { IngestJob, IngestJobStatus, SourceKind } from '@/lib/types';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useWorkspace } from './WorkspaceContext';

/**
 * Global ingestion queue.
 *
 * Wire formats (backend/api/v1/endpoints/ingest.py):
 *  - POST ingest with stream:true  -> NDJSON: JobStatusDTO lines, then IngestResponseDTO
 *  - POST ingest/file (multipart)  -> IngestResponseDTO, no stream
 *  - POST ingest/github           -> IngestResponseDTO immediately, work continues in background
 *
 * For the two non-streaming paths we mint the session_id client-side and
 * subscribe to GET ingest/stream/{session_id} (SSE) to get the same progress.
 */

type JobStatusLine = {
  session_id?: string;
  status?: string;
  message?: string;
  progress?: number;
};

type IngestResponse = {
  success?: boolean;
  url?: string;
  message?: string;
  document_id?: string;
  metadata?: Record<string, unknown>;
};

export type UrlIngestOptions = {
  url: string;
  crawlMode?: 'single' | 'crawl';
  maxPages?: number;
  maxDepth?: number;
};

type CaptureContextValue = {
  jobs: IngestJob[];
  activeCount: number;
  quickOpen: boolean;
  openQuick: () => void;
  closeQuick: () => void;
  ingestUrl: (opts: UrlIngestOptions) => Promise<boolean>;
  ingestUrls: (urls: string[]) => Promise<void>;
  ingestText: (text: string, title?: string) => Promise<boolean>;
  ingestFiles: (files: File[]) => Promise<void>;
  ingestRepo: (repoUrl: string) => Promise<boolean>;
  clearFinished: () => void;
  dismiss: (id: string) => void;
};

const CaptureContext = createContext<CaptureContextValue | undefined>(undefined);

/** Backend job status vocabulary -> our UI status. */
function mapStatus(raw?: string): IngestJobStatus {
  switch (raw) {
    case 'completed':
      return 'done';
    case 'failed':
      return 'error';
    case 'processing':
      return 'running';
    default:
      return 'queued';
  }
}

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const unsubs = useRef<Record<string, () => void>>({});

  const patch = useCallback((id: string, next: Partial<IngestJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...next } : j)));
  }, []);

  const start = useCallback(
    (label: string, kind: SourceKind, sessionId: string): IngestJob => {
      const job: IngestJob = {
        id: uid('job'),
        label,
        kind,
        status: 'queued',
        progress: 0,
        sessionId,
        startedAt: Date.now(),
      };
      setJobs((prev) => [job, ...prev].slice(0, 40));
      return job;
    },
    [],
  );

  const finish = useCallback(
    (id: string, ok: boolean, message?: string, chunks?: number) => {
      patch(id, {
        status: ok ? 'done' : 'error',
        progress: 100,
        message,
        chunks,
        finishedAt: Date.now(),
      });
      unsubs.current[id]?.();
      delete unsubs.current[id];
    },
    [patch],
  );

  /** Attach an SSE progress subscription for endpoints that don't stream inline. */
  const watch = useCallback(
    (job: IngestJob) => {
      if (!job.sessionId) return;
      const stop = subscribeSSE(`ingest/stream/${job.sessionId}`, {
        onMessage: (raw) => {
          const line = raw as JobStatusLine;
          patch(job.id, {
            status: mapStatus(line.status),
            message: line.message,
            progress: typeof line.progress === 'number' ? line.progress : undefined,
          });
          if (line.status === 'completed' || line.status === 'failed') {
            unsubs.current[job.id]?.();
            delete unsubs.current[job.id];
          }
        },
        // Progress is a nicety; losing the stream must not fail the job.
        onError: () => {
          delete unsubs.current[job.id];
        },
      });
      unsubs.current[job.id] = stop;
    },
    [patch],
  );

  /* --------------------------------- URL ---------------------------------- */

  const ingestUrl = useCallback(
    async ({ url, crawlMode = 'single', maxPages = 50, maxDepth = 3 }: UrlIngestOptions) => {
      const trimmed = url.trim();
      if (!trimmed) return false;

      const sessionId = uid('sess');
      const job = start(trimmed, sourceKind(trimmed), sessionId);
      patch(job.id, { status: 'running' });

      let ok = false;
      let lastMessage: string | undefined;

      try {
        await streamNDJSON(
          'ingest',
          {
            url: trimmed,
            session_id: sessionId,
            workspace_id: activeWorkspace?.id ?? null,
            stream: true,
            crawl_mode: crawlMode,
            max_pages: maxPages,
            max_depth: maxDepth,
          },
          (event) => {
            const line = event as unknown as JobStatusLine & IngestResponse;
            // Progress lines carry `status`; the terminal line carries `success`.
            if (typeof line.success === 'boolean') {
              ok = line.success;
              lastMessage = line.message;
              return;
            }
            lastMessage = line.message ?? lastMessage;
            patch(job.id, {
              status: mapStatus(line.status),
              message: line.message,
              progress: typeof line.progress === 'number' ? line.progress : undefined,
            });
          },
        );
      } catch (err) {
        finish(job.id, false, (err as Error).message);
        toast.error(`Could not ingest ${trimmed}`, { description: (err as Error).message });
        return false;
      }

      finish(job.id, ok, lastMessage);
      if (ok) toast.success('Added to your library', { description: trimmed });
      else toast.error('Ingestion failed', { description: lastMessage || trimmed });
      return ok;
    },
    [activeWorkspace?.id, start, patch, finish],
  );

  const ingestUrls = useCallback(
    async (urls: string[]) => {
      const list = urls.map((u) => u.trim()).filter(Boolean);
      // Sequential on purpose: the backend scrapes concurrently per URL already,
      // and firing a dozen crawls at once trips provider rate limits.
      for (const url of list) await ingestUrl({ url });
    },
    [ingestUrl],
  );

  /* --------------------------------- text --------------------------------- */

  const ingestText = useCallback(
    async (text: string, title?: string) => {
      const body = text.trim();
      if (!body) return false;

      const sessionId = uid('sess');
      const label = title?.trim() || `${body.slice(0, 48)}${body.length > 48 ? '…' : ''}`;
      const job = start(label, 'text', sessionId);
      patch(job.id, { status: 'running' });

      let ok = false;
      let lastMessage: string | undefined;

      try {
        await streamNDJSON(
          'ingest',
          {
            url: `snapmind://note/${sessionId}`,
            text: body,
            title: title?.trim() || undefined,
            session_id: sessionId,
            workspace_id: activeWorkspace?.id ?? null,
            stream: true,
          },
          (event) => {
            const line = event as unknown as JobStatusLine & IngestResponse;
            if (typeof line.success === 'boolean') {
              ok = line.success;
              lastMessage = line.message;
              return;
            }
            lastMessage = line.message ?? lastMessage;
            patch(job.id, {
              status: mapStatus(line.status),
              message: line.message,
              progress: typeof line.progress === 'number' ? line.progress : undefined,
            });
          },
        );
      } catch (err) {
        finish(job.id, false, (err as Error).message);
        toast.error('Could not save note', { description: (err as Error).message });
        return false;
      }

      finish(job.id, ok, lastMessage);
      if (ok) toast.success('Note added to your library');
      else toast.error('Could not save note', { description: lastMessage });
      return ok;
    },
    [activeWorkspace?.id, start, patch, finish],
  );

  /* --------------------------------- files -------------------------------- */

  const ingestFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const sessionId = uid('sess');
        const job = start(file.name, sourceKind(file.name), sessionId);
        patch(job.id, { status: 'running' });
        watch(job);

        const form = new FormData();
        form.append('file', file);
        form.append('target_lang', 'auto');
        form.append('session_id', sessionId);
        form.append('tenant_id', 'default');

        try {
          const res = await api.form<IngestResponse>('ingest/file', form);
          finish(job.id, res?.success !== false, res?.message);
          if (res?.success !== false) toast.success(`Indexed ${file.name}`);
          else toast.error(`Could not index ${file.name}`, { description: res?.message });
        } catch (err) {
          finish(job.id, false, (err as Error).message);
          toast.error(`Could not index ${file.name}`, { description: (err as Error).message });
        }
      }
    },
    [start, patch, watch, finish],
  );

  /* ---------------------------------- repo -------------------------------- */

  const ingestRepo = useCallback(
    async (repoUrl: string) => {
      const url = repoUrl.trim();
      if (!url) return false;

      const sessionId = uid('sess');
      const job = start(url, 'github', sessionId);
      patch(job.id, { status: 'running', message: 'Cloning repository…' });
      watch(job);

      try {
        const res = await api.post<IngestResponse>('ingest/github', {
          url,
          session_id: sessionId,
          workspace_id: activeWorkspace?.id ?? null,
        });
        // The clone continues in a background task; SSE reports the real ending.
        if (res?.success === false) {
          finish(job.id, false, res?.message);
          toast.error('Repository ingestion failed', { description: res?.message });
          return false;
        }
        toast.success('Repository queued', { description: 'Indexing continues in the background.' });
        return true;
      } catch (err) {
        finish(job.id, false, (err as Error).message);
        toast.error('Repository ingestion failed', { description: (err as Error).message });
        return false;
      }
    },
    [activeWorkspace?.id, start, patch, watch, finish],
  );

  /* --------------------------------- queue -------------------------------- */

  const clearFinished = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'queued' || j.status === 'running'));
  }, []);

  const dismiss = useCallback((id: string) => {
    unsubs.current[id]?.();
    delete unsubs.current[id];
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const activeCount = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;

  const value = useMemo(
    () => ({
      jobs,
      activeCount,
      quickOpen,
      openQuick: () => setQuickOpen(true),
      closeQuick: () => setQuickOpen(false),
      ingestUrl,
      ingestUrls,
      ingestText,
      ingestFiles,
      ingestRepo,
      clearFinished,
      dismiss,
    }),
    [
      jobs,
      activeCount,
      quickOpen,
      ingestUrl,
      ingestUrls,
      ingestText,
      ingestFiles,
      ingestRepo,
      clearFinished,
      dismiss,
    ],
  );

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCapture must be used within a CaptureProvider');
  return ctx;
}
