'use client';

import ActivityChart from '@/components/dashboard/activity-chart';
import {
  Button,
  ButtonLink,
  CheckLine,
  EmptyState,
  ErrorNote,
  IconBadge,
  PageHeader,
  Panel,
  Pill,
  SectionHeader,
  Skeleton,
  StatTile,
} from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import {
  SOURCE_ACCENT,
  compactNumber,
  prettyUrl,
  relativeTime,
  sourceKind,
} from '@/lib/format';
import type { Analytics, ChatSession, GraphPayload, KeyStatus, Site } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  BookMarked,
  Database,
  KeyRound,
  LayoutDashboard,
  Library,
  MessageSquare,
  Network,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const { activeWorkspace } = useWorkspace();
  const { openQuick } = useCapture();

  const analytics = useApi<Analytics>((signal) => api.get('admin/analytics', { signal }), []);
  const sites = useApi<{ sites: Site[] }>((signal) => api.get('sites', { signal }), []);
  const graph = useApi<GraphPayload>((signal) => api.get('graph/data', { signal }), []);
  const keys = useApi<KeyStatus>((signal) => api.get('status/keys', { signal }), []);
  const tags = useApi<{ tags: string[] }>((signal) => api.get('tags', { signal }), []);
  const chats = useApi<ChatSession[]>(
    (signal) =>
      api.get('chat/sessions', {
        signal,
        query: { workspace_id: activeWorkspace?.id },
      }),
    [activeWorkspace?.id],
  );

  const siteList = sites.data?.sites ?? [];
  const chatList = Array.isArray(chats.data) ? chats.data : [];
  const tagList = tags.data?.tags ?? [];
  const entityCount = graph.data?.nodes?.length ?? 0;

  const loading = analytics.loading || sites.loading;
  const missingKeys = keys.data?.missing_keys ?? [];
  const needsKeys = keys.data ? !keys.data.is_configured : false;

  const hasSources = siteList.length > 0;
  const hasChats = chatList.length > 0;
  const hasBookmarks = (analytics.data?.bookmarks ?? 0) > 0;
  const onboardingDone = hasSources && hasChats && hasBookmarks && !needsKeys;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-8">
        <PageHeader
          icon={<LayoutDashboard className="w-6 h-6" />}
          title="Overview"
          description={
            activeWorkspace
              ? `Everything indexed in ${activeWorkspace.name}, and what you've been doing with it.`
              : 'Everything you have indexed, and what you have been doing with it.'
          }
          actions={
            <>
              <Button variant="outline" size="sm" onClick={openQuick}>
                <Plus className="w-4 h-4" />
                Capture
              </Button>
              <ButtonLink href="/text-generator" variant="gradient" size="sm">
                <Sparkles className="w-4 h-4" />
                Ask your library
              </ButtonLink>
            </>
          }
        />

        {analytics.error && <ErrorNote message={analytics.error} onRetry={analytics.reload} />}

        {/* Provider keys gate — nothing else works without them. */}
        {needsKeys && (
          <Panel className="border-amber-200/70 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/[0.07]">
            <div className="flex flex-wrap items-start gap-4">
              <IconBadge
                icon={<KeyRound className="w-5 h-5" />}
                className="text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300"
              />
              <div className="flex-1 min-w-[16rem]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  Finish connecting your providers
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  SnapMind runs on your own API keys. Ingestion, chat and vision stay disabled until
                  these are set.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {missingKeys.map((k) => (
                    <Pill key={k} tone="warning">
                      {k}
                    </Pill>
                  ))}
                </div>
              </div>
              <ButtonLink href="/settings?tab=providers" variant="primary" size="sm">
                Add keys
              </ButtonLink>
            </div>
          </Panel>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatTile
            label="Sources"
            value={compactNumber(siteList.length)}
            icon={<Library className="w-4 h-4" />}
            accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
            href="/library"
            loading={sites.loading}
          />
          <StatTile
            label="Chunks"
            value={compactNumber(analytics.data?.docs)}
            icon={<Database className="w-4 h-4" />}
            accent="text-primary-600 bg-primary-50 dark:bg-primary-500/10"
            hint={analytics.data?.storage ? `≈ ${analytics.data.storage} indexed` : undefined}
            loading={analytics.loading}
          />
          <StatTile
            label="Bookmarks"
            value={compactNumber(analytics.data?.bookmarks)}
            icon={<BookMarked className="w-4 h-4" />}
            accent="text-sky-600 bg-sky-50 dark:bg-sky-500/10"
            href="/notebook"
            loading={analytics.loading}
          />
          <StatTile
            label="Conversations"
            value={compactNumber(analytics.data?.sessions)}
            icon={<MessageSquare className="w-4 h-4" />}
            accent="text-violet-600 bg-violet-50 dark:bg-violet-500/10"
            href="/text-generator"
            loading={analytics.loading}
          />
          <StatTile
            label="Entities"
            value={compactNumber(entityCount)}
            icon={<Network className="w-4 h-4" />}
            accent="text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-500/10"
            href="/graph"
            loading={graph.loading}
          />
        </div>

        {/* Activity + getting started */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel className="lg:col-span-2">
            {sites.loading ? (
              <div className="space-y-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-44 w-full" />
              </div>
            ) : hasSources ? (
              <ActivityChart timestamps={siteList.map((s) => s.last_updated_at)} days={14} />
            ) : (
              <EmptyState
                icon={<Sparkles className="w-7 h-7" />}
                title="Nothing indexed yet"
                description="Add a web page, a PDF, a YouTube video or a repository and it becomes searchable within seconds."
                action={
                  <Button variant="gradient" onClick={openQuick}>
                    <Plus className="w-4 h-4" />
                    Add your first source
                  </Button>
                }
              />
            )}
          </Panel>

          <Panel>
            {onboardingDone ? (
              <>
                <SectionHeader title="Top tags" description="Themes SnapMind found in your sources" />
                {tags.loading ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-20 rounded-full" />
                    ))}
                  </div>
                ) : tagList.length ? (
                  <div className="flex flex-wrap gap-2">
                    {tagList.slice(0, 18).map((t) => (
                      <Link key={t} href={`/library?tag=${encodeURIComponent(t)}`}>
                        <Pill tone="brand">
                          <Tag className="w-3 h-3" />
                          {t}
                        </Pill>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tags appear once a few sources have been indexed.
                  </p>
                )}
              </>
            ) : (
              <>
                <SectionHeader
                  title="Get set up"
                  description="Four steps to a working knowledge base"
                />
                <ul className="space-y-3">
                  <CheckLine done={!needsKeys}>Connect your provider keys</CheckLine>
                  <CheckLine done={hasSources}>Index your first source</CheckLine>
                  <CheckLine done={hasChats}>Ask a question with citations</CheckLine>
                  <CheckLine done={hasBookmarks}>Save a snippet to your notebook</CheckLine>
                </ul>
                <div className="mt-6">
                  {needsKeys ? (
                    <ButtonLink href="/settings?tab=providers" variant="primary" size="sm">
                      Add provider keys
                    </ButtonLink>
                  ) : !hasSources ? (
                    <Button variant="primary" size="sm" onClick={openQuick}>
                      <Plus className="w-4 h-4" />
                      Add a source
                    </Button>
                  ) : (
                    <ButtonLink href="/text-generator" variant="primary" size="sm">
                      Start a conversation
                    </ButtonLink>
                  )}
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* Recents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel>
            <SectionHeader
              title="Recent conversations"
              action={
                hasChats ? (
                  <Link
                    href="/text-generator"
                    className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline inline-flex items-center gap-1"
                  >
                    Open chat <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : undefined
              }
            />
            {chats.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : hasChats ? (
              <ul className="space-y-1 -mx-2">
                {chatList.slice(0, 6).map((c) => (
                  <li key={c.session_id}>
                    <Link
                      href={`/text-generator/${encodeURIComponent(c.session_id)}`}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    >
                      <IconBadge
                        size="sm"
                        icon={<MessageSquare className="w-3.5 h-3.5" />}
                        className="text-violet-600 bg-violet-50 dark:bg-violet-500/10"
                      />
                      <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">
                        {c.title?.trim() || 'Untitled conversation'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {relativeTime(c.updated_at ?? c.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                No conversations yet. Ask something once you have a source indexed.
              </p>
            )}
          </Panel>

          <Panel>
            <SectionHeader
              title="Recently indexed"
              action={
                hasSources ? (
                  <Link
                    href="/library"
                    className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline inline-flex items-center gap-1"
                  >
                    All sources <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : undefined
              }
            />
            {sites.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : hasSources ? (
              <ul className="space-y-1 -mx-2">
                {siteList.slice(0, 6).map((s) => {
                  const kind = sourceKind(s.url);
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/library?source=${encodeURIComponent(s.url)}`}
                        className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition"
                      >
                        <IconBadge
                          size="sm"
                          icon={<Library className="w-3.5 h-3.5" />}
                          className={cn(SOURCE_ACCENT[kind])}
                        />
                        <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">
                          {prettyUrl(s.url)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                          {relativeTime(s.last_updated_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                Your library is empty.
              </p>
            )}
          </Panel>
        </div>

        {loading && <span className="sr-only">Loading your knowledge base</span>}
      </div>
    </div>
  );
}
