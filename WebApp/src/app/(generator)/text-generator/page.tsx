'use client';

/**
 * RAG chat.
 *
 * Sessions are addressed with `?id=<session_id>` — the same shape the sidebar and
 * the extension's "open in web" handoff already use. A brand-new chat mints its
 * id up front rather than after the first answer, so the reasoning steps,
 * retrieved blocks, and the eventual sync all belong to one session from the
 * first keystroke.
 */

import Composer from '@/components/dashboard/chat/composer';
import Message from '@/components/dashboard/chat/message';
import { PinnedSourcesProvider, usePinned } from '@/components/dashboard/chat/sources';
import { Button, ErrorNote } from '@/components/dashboard/ui';
import { GradientBlob } from '@/components/gradient-blob';
import IngestionModal from '@/components/ingestion/IngestionModal';
import { useSettings } from '@/context/SettingsContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useRagChat } from '@/hooks/use-rag-chat';
import { api } from '@/lib/api-client';
import { uid } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  BookMarked,
  Database,
  GitCompare,
  Layers,
  Loader2,
  Network,
  Sparkles,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useStickToBottom } from 'use-stick-to-bottom';

/* ------------------------------- empty state ------------------------------ */

const STARTERS = [
  {
    icon: Layers,
    accent: 'text-primary-600 bg-primary-50 dark:bg-primary-500/10 dark:text-primary-400',
    title: 'Summarise what I saved',
    prompt: 'Summarise the key themes across everything in this workspace, with citations.',
  },
  {
    icon: GitCompare,
    accent: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400',
    title: 'Compare two sources',
    prompt: 'Compare my pinned sources: where do they agree, and where do they contradict each other?',
  },
  {
    icon: Network,
    accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
    title: 'Find the open questions',
    prompt: 'What questions does my knowledge base raise but not answer? List them with the sources that hint at each.',
  },
  {
    icon: BookMarked,
    accent: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
    title: 'Cross-reference my notebook',
    prompt: 'Which of my saved notes are supported by the documents I indexed, and which are not?',
  },
];

function Welcome({ onPick }: { onPick: (prompt: string) => void }) {
  const { pinned } = usePinned();

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 text-center sm:py-16">
      <span className="button-bg mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-theme-md">
        <Sparkles className="h-6 w-6" />
      </span>

      <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[28px] dark:text-white">
        Ask your knowledge base
      </h1>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Every answer is grounded in the pages, files, and notes you captured — and every claim
        carries a citation you can open at the exact sentence.
      </p>

      {pinned.length > 0 && (
        <p className="mt-3 rounded-full bg-primary-50 px-3 py-1 text-[12px] font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
          Retrieval is focused on {pinned.length} pinned source{pinned.length === 1 ? '' : 's'}
        </p>
      )}

      <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
        {STARTERS.map(({ icon: Icon, accent, title, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onPick(prompt)}
            className="group flex items-start gap-3 rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-theme-xs transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-theme-md dark:border-white/10 dark:bg-dark-primary dark:hover:border-primary-500/40"
          >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', accent)}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-gray-900 dark:text-white">
                {title}
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
                {prompt}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- screen --------------------------------- */

function ChatScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const { prefs } = useSettings();
  const { urls: pinnedUrls } = usePinned();

  const [ingestOpen, setIngestOpen] = useState(false);
  const urlId = searchParams.get('id');

  // A fresh chat needs an id before the first send so that reasoning steps,
  // blocks, and the sync all land on one session. Kept in a ref so re-renders
  // don't mint a second one.
  const mintedRef = useRef<string | null>(null);
  if (!urlId && !mintedRef.current) mintedRef.current = uid('sess');
  useEffect(() => {
    if (urlId) mintedRef.current = null;
  }, [urlId]);

  const sessionId = urlId ?? mintedRef.current!;

  const onSessionCreated = useCallback(
    (id: string) => {
      // replaceState rather than router.push: a route transition here would
      // remount the transcript and throw away the answer that just streamed.
      window.history.replaceState(null, '', `/text-generator?id=${id}`);
    },
    [],
  );

  const defaults = useMemo(
    () => ({
      pinnedUrls,
      queryNotebook: prefs.retrieval.queryNotebook,
      useReranking: prefs.retrieval.reranking,
      useGraphrag: prefs.retrieval.graphRag,
      useQueryEnhancement: prefs.retrieval.queryEnhancement,
      personaId: prefs.personaId,
      outputLang: prefs.outputLang,
    }),
    [
      pinnedUrls,
      prefs.retrieval.queryNotebook,
      prefs.retrieval.reranking,
      prefs.retrieval.graphRag,
      prefs.retrieval.queryEnhancement,
      prefs.personaId,
      prefs.outputLang,
    ],
  );

  const chat = useRagChat({
    sessionId,
    workspaceId: activeWorkspace?.id,
    onSessionCreated,
    defaults,
  });

  const { scrollRef, contentRef } = useStickToBottom();

  /* --------------------------------- branch -------------------------------- */

  /** Fork the transcript up to `assistantId` into a brand-new session. */
  const branch = useCallback(
    async (assistantId: string) => {
      const idx = chat.messages.findIndex((m) => m.id === assistantId);
      if (idx < 0) return;
      const slice = chat.messages.slice(0, idx + 1);
      const newId = uid('sess');
      const title = slice.find((m) => m.role === 'user')?.content ?? 'Branched chat';

      try {
        await api.post('chat/sync', {
          session_id: newId,
          title: `↳ ${title.slice(0, 56)}`,
          workspace_id: activeWorkspace?.id ?? null,
          messages: slice.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            blocks: m.blocks,
            thoughts: m.thoughts,
            metadata: m.metadata,
          })),
        });
        toast.success('Branched into a new chat');
        router.push(`/text-generator?id=${newId}`);
      } catch {
        toast.error('Could not branch this chat');
      }
    },
    [chat.messages, activeWorkspace?.id, router],
  );

  /* ---------------------------------- view --------------------------------- */

  if (chat.loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full relative">
      <div className="pointer-events-none absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <Button
          variant="soft"
          size="sm"
          onClick={() => setIngestOpen(true)}
          className="pointer-events-auto !rounded-full"
        >
          <Database className="h-3.5 w-3.5 text-primary-500" />
          Manage knowledge
        </Button>
      </div>

      <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto relative z-10">
        <div ref={contentRef} className="pb-4">
          {chat.isEmpty ? (
            <Welcome onPick={(p) => chat.send(p)} />
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-6 pt-16 sm:px-6 sm:pb-8 sm:pt-20">
              {chat.messages.map((m, i) => (
                <Message
                  key={m.id}
                  message={m}
                  streaming={chat.streaming && i === chat.messages.length - 1}
                  onRegenerate={chat.regenerate}
                  onBranch={branch}
                  onEdit={chat.editAndResend}
                />
              ))}

              {chat.error && (
                <ErrorNote
                  message={chat.error}
                  onRetry={() => {
                    const last = [...chat.messages].reverse().find((m) => m.role === 'assistant');
                    if (last) chat.regenerate(last.id);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 pt-3 pb-2">
        <Composer
          onSend={chat.send}
          onStop={chat.stop}
          streaming={chat.streaming}
          suggestions={chat.suggestions}
          autoFocus={chat.isEmpty}
          initialValue={searchParams.get('ask') ?? undefined}
        />
      </div>

      <IngestionModal isOpen={ingestOpen} onClose={() => setIngestOpen(false)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      }
    >
      <PinnedSourcesProvider>
        <ChatScreen />
      </PinnedSourcesProvider>
    </Suspense>
  );
}
