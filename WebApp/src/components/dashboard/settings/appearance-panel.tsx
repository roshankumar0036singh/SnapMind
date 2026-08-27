'use client';

/**
 * Appearance and account.
 *
 * Theme is a three-way choice, not a switch: `system` is the default the root
 * layout sets, and collapsing it to light/dark would silently opt the reader out
 * of following their OS. `resolvedTheme` is only read after mount, because
 * next-themes has no answer during SSR and rendering a guess would flash.
 *
 * The account section is deliberately thin. The backend has no profile route, so
 * everything shown here comes from the Supabase session that
 * `utils/supabase/client` already holds — name, email, provider, when the
 * account was created. Changing an email or password happens in Supabase's own
 * flows (`/reset-password`), not here.
 */

import { Button, INSET, Panel, Pill, SectionHeader, Skeleton } from '@/components/dashboard/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { Laptop, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const THEMES: { value: string; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    hint: 'Always light, whatever your device does.',
    icon: <Sun className="h-4 w-4" />,
  },
  {
    value: 'dark',
    label: 'Dark',
    hint: 'Always dark, whatever your device does.',
    icon: <Moon className="h-4 w-4" />,
  },
  {
    value: 'system',
    label: 'Match device',
    hint: 'Follows your operating system, including its light/dark schedule.',
    icon: <Laptop className="h-4 w-4" />,
  },
];

export function AppearancePanel() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Panel>
      <SectionHeader
        title="Theme"
        description="Applies to the dashboard and the marketing site — it's stored in this browser, not on your account."
      />
      <div className="grid gap-2.5 sm:grid-cols-3">
        {THEMES.map((t) => {
          const active = mounted && theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              aria-pressed={active}
              className={cn(
                'rounded-2xl border p-4 text-left transition',
                active
                  ? 'border-primary-300 bg-primary-50/70 dark:border-primary-500/40 dark:bg-primary-500/10'
                  : 'border-gray-100 bg-white hover:border-gray-200 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl',
                  active
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
                )}
              >
                {t.icon}
              </span>
              <span className="mt-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  {t.label}
                </span>
                {t.value === 'system' && active && mounted && (
                  <Pill tone="neutral">{resolvedTheme === 'dark' ? 'dark now' : 'light now'}</Pill>
                )}
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>
      {!mounted && <Skeleton className="mt-3 h-3 w-40" />}
    </Panel>
  );
}

/* -------------------------------- account --------------------------------- */

type Profile = {
  name: string;
  email: string;
  avatar?: string | null;
  provider?: string;
  createdAt?: string;
};

export function AccountPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u) return;
        setProfile({
          name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Account',
          email: u.email ?? '',
          avatar: u.user_metadata?.avatar_url ?? null,
          provider: u.app_metadata?.provider,
          createdAt: u.created_at,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/signin');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Panel>
        <SectionHeader
          title="Signed in as"
          description="From your Supabase session — the same identity every request to the backend carries."
        />
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : !profile ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No active session. <a className="text-primary-600 underline" href="/signin">Sign in</a>{' '}
            to see your account.
          </p>
        ) : (
          <div className={cn(INSET, 'flex flex-wrap items-center gap-4 px-4 py-4')}>
            <span className="dashboard-gradient flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {profile.avatar ? (
                // Provider avatars come from arbitrary hosts; a plain img avoids
                // whitelisting each one in next.config remotePatterns.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-white">
                  {initials(profile.name || profile.email)}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                {profile.name}
              </p>
              <p className="truncate text-[12.5px] text-gray-500 dark:text-gray-400">
                {profile.email || 'No email on this account'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {profile.provider && <Pill tone="neutral">via {profile.provider}</Pill>}
                {profile.createdAt && (
                  <span className="text-[11.5px] text-gray-400 dark:text-gray-500">
                    joined{' '}
                    {new Date(profile.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} loading={signingOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          Changing your password goes through Supabase&apos;s own flow — sign out and use{' '}
          <a className="text-primary-600 underline dark:text-primary-300" href="/reset-password">
            reset password
          </a>
          . Deleting an account isn&apos;t exposed by the backend; nothing here would remove your
          documents, so it isn&apos;t offered as if it would.
        </p>
      </Panel>

      <AboutPanel />
    </div>
  );
}

/* --------------------------------- about ---------------------------------- */

function AboutPanel() {
  const version = useApi<{ version?: string; build?: string }>(
    (signal) => api.get('status/version', { signal }),
    [],
  );

  return (
    <Panel>
      <SectionHeader title="About" description="What this dashboard is talking to." />
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Backend">
          {version.loading && !version.data ? (
            <Skeleton className="h-3 w-24" />
          ) : version.error ? (
            <span className="text-error-500">unreachable</span>
          ) : (
            <>
              v{version.data?.version ?? 'unknown'}
              {version.data?.build ? ` · ${version.data.build}` : ''}
            </>
          )}
        </Row>
        <Row label="API base">
          <span className="font-mono text-[11.5px]">
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
          </span>
        </Row>
        <Row label="Chrome extension">SnapMind 2.0.0</Row>
        <Row label="MCP server">snapmind-mcp 2.1.2</Row>
      </dl>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2 dark:border-white/10">
      <dt className="text-[12.5px] text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-[12.5px] font-medium text-gray-900 dark:text-white/90">{children}</dd>
    </div>
  );
}
