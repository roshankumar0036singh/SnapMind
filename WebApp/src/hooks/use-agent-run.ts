'use client';

/**
 * One agent run: its in-flight state, its elapsed clock, and its cancellation.
 *
 * Every research mode is the same interaction — press go, wait a long time,
 * get one payload or one error — so they share this instead of each page
 * re-inventing a `loading` boolean. The elapsed clock is not decoration: a
 * browser-agent run routinely takes 30-90 seconds and a debate runs two of them
 * at once, so a spinner with no timer is indistinguishable from a hang.
 *
 * `stop()` aborts the request the browser side. It does not stop the backend —
 * the orchestrator has no cancellation channel — so it is worded as "stop
 * waiting", not "cancel", wherever it is surfaced.
 */

import { ApiError } from '@/lib/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AgentRun<T> = {
  running: boolean;
  /** Milliseconds since the current (or last) run started. */
  elapsed: number;
  result: T | undefined;
  error: string | undefined;
  /** True once a run has finished, successfully or not. */
  done: boolean;
  run: (fn: (signal: AbortSignal) => Promise<T>) => Promise<T | undefined>;
  stop: () => void;
  reset: () => void;
  /** Replace the result in place — used when a stream refines it as it arrives. */
  setResult: (r: T | undefined) => void;
};

export function useAgentRun<T>(): AgentRun<T> {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef<number>(0);

  // Abort in flight work if the page unmounts mid-run.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(Date.now() - startRef.current), 500);
    return () => window.clearInterval(id);
  }, [running]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setResult(undefined);
    setError(undefined);
    setDone(false);
    setElapsed(0);
  }, []);

  const run = useCallback(async (fn: (signal: AbortSignal) => Promise<T>) => {
    // A second press replaces the first run rather than racing it.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    startRef.current = Date.now();
    setElapsed(0);
    setError(undefined);
    setResult(undefined);
    setDone(false);
    setRunning(true);

    try {
      const out = await fn(controller.signal);
      if (controller.signal.aborted) return undefined;
      setResult(out);
      setDone(true);
      return out;
    } catch (err) {
      if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return undefined;
      setError(describe(err));
      setDone(true);
      return undefined;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setRunning(false);
        setElapsed(Date.now() - startRef.current);
      }
    }
  }, []);

  return { running, elapsed, result, error, done, run, stop, reset, setResult };
}

/**
 * Turn a thrown value into something worth reading.
 *
 * Agent runs fail in two characteristic ways that a bare message hides: a 502
 * from the BFF means the backend is not up, and a 500 whose detail mentions a
 * provider usually means a missing BYOK key. Both get pointed at directly.
 */
function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 502) return err.message;
    if (err.status === 401 || err.status === 403) return 'Your session expired — sign in again.';
    if (/api[_ ]?key|unauthorized|quota|credit/i.test(err.message)) {
      return `${err.message} — check Settings → Providers.`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'The run failed for an unknown reason.';
}
