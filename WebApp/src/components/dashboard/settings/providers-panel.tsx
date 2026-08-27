'use client';

/**
 * Providers — bring-your-own-key.
 *
 * Two independent facts get their own sections here, because conflating them is
 * the easy way to mislead:
 *
 *  - **Your keys** live in this browser's localStorage and ride along as
 *    `x-…-key` headers on every request (api-client attaches them). Each endpoint
 *    reads them off the request (`req.headers.get("x-gemini-key")`), so nothing is
 *    stored server-side and nothing is logged.
 *  - **The server's own keys** are what `GET status/keys` reports. That check
 *    looks at exactly four environment names on the backend and knows nothing
 *    about the key you paste here — so it is shown as server readiness, never as
 *    "your key is valid".
 *
 * When a provider has no key from you, `api_clients.py` falls back to the
 * server's environment, so a provider can work perfectly well with nothing typed
 * in. There is no endpoint that validates a single key, so instead of a fake
 * green tick this panel offers one honest end-to-end check: a short translation,
 * which exercises the Lingo.dev → Mistral → Gemini text path and reports whatever
 * comes back.
 */

import {
  Button,
  ErrorNote,
  Panel,
  Pill,
  SectionHeader,
  Skeleton,
} from '@/components/dashboard/ui';
import { PROVIDERS, useSettings } from '@/context/SettingsContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import type { KeyStatus, ProviderId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Check, Eye, EyeOff, ExternalLink, KeyRound, Server, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/** The four names config.get_missing_keys() actually checks (config.py:120). */
const SERVER_CHECKED = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'DATABASE_URL'];

export default function ProvidersPanel() {
  const { keys, setKey, clearKey, hydrated } = useSettings();
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [shown, setShown] = useState<Partial<Record<ProviderId, boolean>>>({});

  const status = useApi<KeyStatus>((signal) => api.get('status/keys', { signal }), []);

  // Seed the inputs once storage has been read, so they don't flash empty.
  useEffect(() => {
    if (hydrated) setDrafts(keys);
  }, [hydrated, keys]);

  const save = (id: ProviderId, label: string) => {
    const value = (drafts[id] ?? '').trim();
    if (!value) {
      clearKey(id);
      toast.success(`${label} key removed from this browser`);
      return;
    }
    setKey(id, value);
    toast.success(`${label} key saved in this browser`);
  };

  const remove = (id: ProviderId, label: string) => {
    clearKey(id);
    setDrafts((prev) => ({ ...prev, [id]: '' }));
    toast.success(`${label} key removed`);
  };

  return (
    <div className="space-y-6">
      <Panel>
        <SectionHeader
          title="Your keys"
          description="Stored in this browser and sent with each request. They never reach our storage."
        />

        <div className="space-y-5">
          {PROVIDERS.map((provider) => {
            const stored = keys[provider.id];
            const draft = drafts[provider.id] ?? '';
            const dirty = (stored ?? '') !== draft.trim();
            const reveal = !!shown[provider.id];

            return (
              <div
                key={provider.id}
                className="rounded-2xl border border-gray-100 p-4 dark:border-white/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                        {provider.label}
                      </h3>
                      {stored ? (
                        <Pill tone="success">
                          <Check className="h-3 w-3" />
                          Sending
                        </Pill>
                      ) : (
                        <Pill tone="neutral">Server&apos;s key</Pill>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {provider.purpose}
                    </p>
                  </div>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 transition hover:text-primary-700 dark:text-primary-400"
                  >
                    Get a key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[14rem] flex-1">
                    <input
                      type={reveal ? 'text' : 'password'}
                      value={draft}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [provider.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') save(provider.id, provider.label);
                      }}
                      placeholder={hydrated ? 'Paste a key to use your own quota' : 'Loading…'}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 pr-11 font-mono text-[12.5px] text-gray-900 transition placeholder:font-sans placeholder:text-gray-400 focus:border-primary-400 focus:shadow-ring focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShown((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                      }
                      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
                    >
                      {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{reveal ? 'Hide' : 'Show'} the key</span>
                    </button>
                  </div>

                  <Button
                    variant={dirty ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => save(provider.id, provider.label)}
                    disabled={!dirty}
                  >
                    {dirty ? 'Save' : 'Saved'}
                  </Button>
                  {stored && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(provider.id, provider.label)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-gray-50 px-4 py-3 text-[12px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Leave one blank and the server falls back to its own key for that provider, if it has
            one. Keys live in this browser&apos;s local storage — clearing site data removes them,
            and another device won&apos;t have them.
          </span>
        </p>
      </Panel>

      <ServerReadiness status={status} />
      <LiveCheck />
    </div>
  );
}

/* ----------------------------- server readiness --------------------------- */

function ServerReadiness({
  status,
}: {
  status: ReturnType<typeof useApi<KeyStatus>>;
}) {
  const missing = status.data?.missing_keys ?? [];

  return (
    <Panel>
      <SectionHeader
        title="Server readiness"
        description="What the backend has configured in its own environment — not a check of the keys above."
        action={
          <Button variant="ghost" size="sm" onClick={status.reload} loading={status.loading}>
            Re-check
          </Button>
        }
      />

      {status.error ? (
        <ErrorNote message={status.error} onRetry={status.reload} />
      ) : status.loading && !status.data ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <Server
              className={cn(
                'h-4 w-4',
                status.data?.is_configured
                  ? 'text-success-600'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            />
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {status.data?.is_configured
                ? 'Every name the backend checks is set.'
                : `${missing.length} of the ${SERVER_CHECKED.length} names the backend checks ${missing.length === 1 ? 'is' : 'are'} unset.`}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SERVER_CHECKED.map((name) => {
              const gone = missing.includes(name);
              return (
                <Pill key={name} tone={gone ? 'warning' : 'success'}>
                  <span className="font-mono text-[11px]">{name}</span>
                  {gone ? '· unset' : '· set'}
                </Pill>
              );
            })}
          </div>

          {/* Anything outside those four (Firecrawl, Lingo.dev, Apify) is simply
              not part of the health check, so absence of a warning is not proof
              that a feature depending on it will work. */}
          <p className="mt-4 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
            Firecrawl, Lingo.dev and Apify aren&apos;t part of this check — web research and
            translation can still fail with everything above green. Paste your own keys for those
            and they&apos;ll be used regardless of the server&apos;s configuration.
          </p>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------- live check ------------------------------- */

const SAMPLE = 'Knowledge is only useful when you can find it again.';

function LiveCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    setFailure(null);
    try {
      const res = await api.post<{
        translatedText?: string;
        originalLang?: string;
        isTranslated?: boolean;
      }>('translate', { text: SAMPLE, target_lang: 'French' });
      if (res?.translatedText && res.isTranslated !== false) {
        setResult(res.translatedText);
      } else {
        setFailure(
          'The request succeeded but nothing was translated — usually a missing Lingo.dev, Mistral and Gemini key all at once.',
        );
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <SectionHeader
        title="Live check"
        description="Translates one sentence, end to end, using whichever text model answers first."
        action={
          <Button variant="soft" size="sm" onClick={run} loading={busy}>
            <Wand2 className="h-3.5 w-3.5" />
            Run
          </Button>
        }
      />

      <p className="rounded-2xl bg-gray-50 px-4 py-3 text-[12.5px] italic text-gray-600 dark:bg-white/5 dark:text-gray-300">
        “{SAMPLE}”
      </p>

      {result && (
        <div className="mt-3 rounded-2xl border border-success-100 bg-success-50 px-4 py-3 dark:border-success-600/25 dark:bg-success-600/10">
          <p className="text-[12.5px] text-success-600 dark:text-emerald-200">{result}</p>
          <p className="mt-1.5 text-[11px] text-success-600/80 dark:text-emerald-300/80">
            A text model answered — the request path, your bearer token and at least one provider
            key all work. It doesn&apos;t say which provider served it.
          </p>
        </div>
      )}

      {failure && <div className="mt-3">{<ErrorNote message={failure} onRetry={run} />}</div>}
    </Panel>
  );
}
