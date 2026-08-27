'use client';

import { ApiError } from '@/lib/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
};

/**
 * Minimal data-fetching hook: run an async loader, expose {data, error, loading}
 * and a `reload`. Deliberately not a cache — dashboard pages are cheap to refetch
 * and always want fresh counts.
 *
 * `deps` behaves like a useEffect dependency list; pass `null` to skip the fetch
 * entirely (e.g. while the active workspace is still resolving).
 */
export function useApi<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] | null,
): State<T> & { reload: () => void; setData: (v: T) => void } {
  const [state, setState] = useState<State<T>>({
    data: undefined,
    error: undefined,
    loading: deps !== null,
  });
  const [nonce, setNonce] = useState(0);

  // Keep the latest loader without making it a dependency, so callers can pass
  // an inline arrow function without causing a refetch loop.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const skip = deps === null;
  const depKey = JSON.stringify(deps ?? []);

  useEffect(() => {
    if (skip) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }

    const controller = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));

    loaderRef
      .current(controller.signal)
      .then((data) => {
        if (alive) setState({ data, error: undefined, loading: false });
      })
      .catch((err: unknown) => {
        if (!alive || controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong';
        setState({ data: undefined, error: message, loading: false });
      });

    return () => {
      alive = false;
      controller.abort();
    };
    // depKey serialises the caller's deps; nonce forces a manual reload.
  }, [depKey, nonce, skip]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((v: T) => setState((s) => ({ ...s, data: v })), []);

  return { ...state, reload, setData };
}
