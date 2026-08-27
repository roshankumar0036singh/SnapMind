'use client';

/**
 * Settings.
 *
 * A shell over five panels, each of which owns its own data and lives in
 * `components/dashboard/settings/`. Nothing is implemented inline here: the
 * retrieval switches and the persona picker also appear on the chat composer, and
 * the provider keys are read by the capture and dashboard screens, so a second
 * copy of either would be a second source of truth waiting to drift.
 *
 * The active tab lives in `?tab=` rather than component state so that a link can
 * point at one — the "Add keys" prompts on /dashboard and /capture deep-link
 * straight to Providers — and so the back button walks tabs the way a reader
 * expects.
 *
 * Per-workspace overrides are deliberately not here. They belong to a workspace,
 * so /workspaces edits them; this screen only says when one is shadowing an
 * account default.
 */

import AnswersPanel from '@/components/dashboard/settings/answers-panel';
import ApiKeysPanel from '@/components/dashboard/settings/api-keys-panel';
import { AccountPanel, AppearancePanel } from '@/components/dashboard/settings/appearance-panel';
import ProvidersPanel from '@/components/dashboard/settings/providers-panel';
import { PageHeader } from '@/components/dashboard/ui';
import { cn } from '@/lib/utils';
import { Key, KeyRound, Loader2, Palette, Settings, Sparkles, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const TABS = [
  {
    id: 'providers',
    label: 'Providers',
    icon: Key,
    blurb: 'Your own model and scraping keys, kept in this browser.',
  },
  {
    id: 'keys',
    label: 'API keys',
    icon: KeyRound,
    blurb: 'Personal keys so editors and the MCP server can reach your knowledge base.',
  },
  {
    id: 'answers',
    label: 'Answers',
    icon: Sparkles,
    blurb: 'Retrieval, language, and the voice answers are written in.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    blurb: 'Light, dark, or whatever your device is doing.',
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    blurb: 'Who you are signed in as, and what this dashboard is talking to.',
  },
] as const;

type TabId = (typeof TABS)[number]['id'];

const DEFAULT_TAB: TabId = 'providers';

function isTab(v: string | null): v is TabId {
  return !!v && TABS.some((t) => t.id === v);
}

function SettingsScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get('tab');
  const tab: TabId = isTab(raw) ? raw : DEFAULT_TAB;
  const current = TABS.find((t) => t.id === tab)!;

  // replace, not push: switching tabs isn't a navigation the reader wants to
  // walk back through one at a time — but the URL still has to be linkable.
  const select = (next: TabId) =>
    router.replace(next === DEFAULT_TAB ? '/settings' : `/settings?tab=${next}`, { scroll: false });

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-gray-50/60 dark:bg-dark-secondary">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <PageHeader
          icon={<Settings className="h-6 w-6" />}
          title="Settings"
          description={current.blurb}
          accent="text-gray-500 bg-gray-100 dark:bg-white/10 dark:text-gray-300"
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <nav aria-label="Settings sections" className="shrink-0 lg:w-56">
            {/* Horizontal and scrollable on small screens, a rail on large ones —
                five tabs don't fit across a phone without truncating each label. */}
            <ul className="custom-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <li key={id} className="shrink-0 lg:w-full">
                    <button
                      type="button"
                      onClick={() => select(id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                        active
                          ? 'bg-primary-50 text-primary-700 shadow-theme-xs dark:bg-primary-500/15 dark:text-primary-300'
                          : 'text-gray-500 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 flex-1">
            {tab === 'providers' && <ProvidersPanel />}
            {tab === 'keys' && <ApiKeysPanel />}
            {tab === 'answers' && <AnswersPanel />}
            {tab === 'appearance' && <AppearancePanel />}
            {tab === 'account' && <AccountPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      }
    >
      <SettingsScreen />
    </Suspense>
  );
}
