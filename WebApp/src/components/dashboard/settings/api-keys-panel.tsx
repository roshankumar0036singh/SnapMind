'use client';

/**
 * Personal API keys — the credential the MCP server (and any CLI) uses.
 *
 * `POST auth/generate-key` is the only place the plaintext `snp_…` key ever
 * exists: the backend stores a SHA-256 hash plus a 12-character prefix and
 * cannot reproduce it. So the reveal panel here is deliberately sticky — it stays
 * until you dismiss it, rather than disappearing on the next render — and it is
 * the one place the ready-to-paste MCP config carries the real key.
 *
 * All three routes need `SUPABASE_SERVICE_ROLE_KEY` on the server and return 500
 * without it, which is a server misconfiguration rather than anything the reader
 * did wrong — so that case gets its own explanation instead of a bare error.
 */

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  FIELD,
  IconButton,
  INSET,
  Panel,
  Pill,
  SectionHeader,
  Skeleton,
} from '@/components/dashboard/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import type { PersonalApiKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Check, Copy, KeyRound, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type GeneratedKey = { key: string; prefix: string; name: string };

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function mcpConfig(key: string) {
  return `{
  "mcpServers": {
    "snapmind": {
      "command": "uvx",
      "args": ["snapmind-mcp"],
      "env": {
        "SNAPMIND_BACKEND_URL": "${BACKEND_URL}",
        "SNAPMIND_API_KEY": "${key}"
      }
    }
  }
}`;
}

export default function ApiKeysPanel() {
  const keys = useApi<PersonalApiKey[]>(async (signal) => {
    const res = await api.get<{ success?: boolean; keys?: PersonalApiKey[] }>('auth/keys', {
      signal,
    });
    return Array.isArray(res?.keys) ? res.keys : [];
  }, []);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<GeneratedKey | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<PersonalApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.post<{ key?: string; prefix?: string; name?: string }>(
        'auth/generate-key',
        { name: name.trim() || 'Default' },
      );
      if (!res?.key) throw new Error('The server did not return a key');
      setRevealed({ key: res.key, prefix: res.prefix ?? '', name: res.name ?? 'Default' });
      setName('');
      void keys.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the key');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    if (!pendingRevoke) return;
    setRevoking(true);
    try {
      await api.del(`auth/keys/${pendingRevoke.id}`);
      keys.setData((keys.data ?? []).filter((k) => k.id !== pendingRevoke.id));
      toast.success('Key revoked — anything using it will stop working immediately');
      setPendingRevoke(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not revoke the key');
    } finally {
      setRevoking(false);
    }
  };

  const serviceRoleMissing =
    !!keys.error && /service role/i.test(keys.error);

  return (
    <div className="space-y-6">
      {revealed && (
        <RevealPanel generated={revealed} onDismiss={() => setRevealed(null)} />
      )}

      <Panel>
        <SectionHeader
          title="Create a key"
          description="One key per tool, so revoking one doesn't break the others."
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creating) void create();
            }}
            placeholder="What will use this key? e.g. Claude Desktop"
            maxLength={60}
            className={cn(FIELD, 'min-w-[16rem] flex-1')}
          />
          <Button variant="gradient" onClick={create} loading={creating}>
            <Plus className="h-4 w-4" />
            Generate
          </Button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          The full key is shown once, right after it&apos;s created. Only a hash and the first 12
          characters are stored, so it can&apos;t be shown again — generate a new one if you lose it.
        </p>
      </Panel>

      <Panel>
        <SectionHeader
          title="Your keys"
          description="Every key here can read and write your whole knowledge base."
          action={
            <Button variant="ghost" size="sm" onClick={keys.reload} loading={keys.loading}>
              Refresh
            </Button>
          }
        />

        {serviceRoleMissing ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3.5 dark:border-amber-500/25 dark:bg-amber-500/10">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
              <p className="font-semibold">The server can&apos;t manage keys yet.</p>
              <p className="mt-1">
                Personal keys are written with Supabase&apos;s service-role client, so the backend
                needs <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in its
                environment. Until it&apos;s set, creating, listing and revoking all fail with a 500.
              </p>
            </div>
          </div>
        ) : keys.error ? (
          <ErrorNote message={keys.error} onRetry={keys.reload} />
        ) : keys.loading && !keys.data ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (keys.data ?? []).length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-7 w-7" />}
            title="No keys yet"
            description="Generate one above to connect Claude Desktop, an MCP client or your own scripts."
          />
        ) : (
          <ul className="space-y-2">
            {(keys.data ?? []).map((k) => (
              <li
                key={k.id}
                className={cn(INSET, 'flex flex-wrap items-center justify-between gap-3 px-4 py-3')}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                      {k.name || 'Untitled key'}
                    </span>
                    <Pill tone="neutral">
                      <span className="font-mono text-[11px]">{k.key_prefix || 'snp_…'}</span>
                    </Pill>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">
                    {k.created_at ? `Created ${dateOnly(k.created_at)}` : 'Created recently'}
                    {' · '}
                    {k.last_used_at ? `last used ${dateOnly(k.last_used_at)}` : 'never used'}
                  </p>
                </div>
                <IconButton
                  icon={<Trash2 className="h-4 w-4" />}
                  label={`Revoke ${k.name || 'this key'}`}
                  onClick={() => setPendingRevoke(k)}
                  className="hover:text-error-500 hover:bg-error-50 dark:hover:text-error-500 dark:hover:bg-error-500/10"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          title="Connect an MCP client"
          description="Paste this into claude_desktop_config.json, with a real key in place of the placeholder."
        />
        <CopyBlock
          value={mcpConfig('snp_your_generated_key')}
          label="MCP configuration"
        />
        <p className="mt-3 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          Provider keys can go in the same <code className="font-mono">env</code> block —{' '}
          <code className="font-mono">GEMINI_API_KEY</code>,{' '}
          <code className="font-mono">MISTRAL_API_KEY</code>,{' '}
          <code className="font-mono">FIRECRAWL_API_KEY</code>,{' '}
          <code className="font-mono">LINGODEV_API_KEY</code> — and the keys you saved in the
          Providers tab don&apos;t carry over, because those live in this browser.
        </p>
      </Panel>

      <ConfirmDialog
        open={!!pendingRevoke}
        onClose={() => setPendingRevoke(null)}
        onConfirm={revoke}
        loading={revoking}
        title={`Revoke ${pendingRevoke?.name || 'this key'}?`}
        description="Anything authenticating with it — an MCP client, a script — stops working at once. This can't be undone, but you can generate a replacement."
        confirmLabel="Revoke key"
      />
    </div>
  );
}

/* -------------------------------- reveal ---------------------------------- */

function RevealPanel({
  generated,
  onDismiss,
}: {
  generated: GeneratedKey;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-3xl border border-primary-100 bg-primary-50/60 p-5 shadow-theme-sm dark:border-primary-500/25 dark:bg-primary-500/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <KeyRound className="h-4 w-4 text-primary-600 dark:text-primary-300" />
            {generated.name} is ready
          </h3>
          <p className="mt-1 text-[12.5px] text-gray-600 dark:text-gray-300">
            Copy it now — this is the only time it will be shown.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          I&apos;ve saved it
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <CopyBlock value={generated.key} label="API key" />
        <details className="group">
          <summary className="cursor-pointer text-[12.5px] font-medium text-primary-600 transition hover:text-primary-700 dark:text-primary-300">
            Show the MCP config with this key filled in
          </summary>
          <div className="mt-3">
            <CopyBlock value={mcpConfig(generated.key)} label="MCP configuration" />
          </div>
        </details>
      </div>
    </div>
  );
}

/* ------------------------------- copy block ------------------------------- */

function CopyBlock({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions policy).
      // Selecting the text by hand still works, so say that instead of failing silently.
      toast.error('Your browser blocked clipboard access — select the text and copy it manually');
    }
  };

  return (
    <div className="relative">
      <pre className="max-h-72 overflow-auto rounded-xl border border-gray-100 bg-white px-3.5 py-3 pr-12 font-mono text-[11.5px] leading-relaxed text-gray-700 custom-scrollbar dark:border-white/10 dark:bg-black/30 dark:text-gray-300">
        {value}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-500 shadow-theme-xs transition hover:text-gray-900 dark:border-white/10 dark:bg-dark-secondary dark:text-gray-400 dark:hover:text-white"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function dateOnly(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'recently';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
