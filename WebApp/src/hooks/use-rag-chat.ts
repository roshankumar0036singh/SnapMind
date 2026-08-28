'use client';

/**
 * RAG chat over the backend's NDJSON stream.
 *
 * Replaces the `useChat` (`@ai-sdk/react`) integration that used to drive
 * /text-generator. The Vercel AI SDK protocol and SnapMind's protocol are not
 * the same thing: SnapMind emits retrieved blocks, a reasoning chain, and
 * system notices alongside the tokens, and there is no terminal "done" frame —
 * the stream simply ends. Modelling that directly is less code than bending the
 * SDK around it, and it keeps citations attached to the message they belong to.
 *
 * Wire contract verified against:
 *   - api/v1/endpoints/search.py        POST /search/chat/stream
 *   - services/search_service.py:245+  event vocabulary
 *   - api/v1/endpoints/chat.py          /chat/sync, /chat/sessions, /chat/suggest
 */

import { api, ApiError, streamNDJSON } from '@/lib/api-client';
import { uid } from '@/lib/format';
import type {
  ChatMessage,
  ChatMetadata,
  RetrievedBlock,
  StreamEvent,
  ThoughtStep,
} from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

/* --------------------------------- options -------------------------------- */

export type SendOptions = {
  /** Source urls to restrict retrieval to — the pinned-sources tray. */
  pinnedUrls?: string[];
  /** Also search the user's saved bookmarks (nb-block-N citations). */
  queryNotebook?: boolean;
  personaId?: string | null;
  outputLang?: string;
  /** Raw page text to answer from before falling back to the knowledge base. */
  pageContent?: string | null;
  /** Per-request retrieval overrides — None/undefined = use server default. */
  useReranking?: boolean;
  useGraphrag?: boolean;
  useQueryEnhancement?: boolean;
};

type UseRagChatArgs = {
  sessionId: string;
  workspaceId?: string | null;
  /** Called the first time a brand-new session is persisted, so the URL can update. */
  onSessionCreated?: (sessionId: string) => void;
  /** Defaults applied to every send; `send`'s own options win. */
  defaults?: SendOptions;
};

/** Shape stored in `chat_sessions.messages` (jsonb). */
type StoredMessage = {
  id?: string;
  role?: string;
  content?: string;
  createdAt?: string;
  blocks?: RetrievedBlock[];
  thoughts?: ThoughtStep[];
  metadata?: ChatMetadata;
  /** Legacy rows written by the AI-SDK era stored parts instead of content. */
  parts?: { type?: string; text?: string }[];
};

/* -------------------------------- helpers --------------------------------- */

/** Title for a fresh session: the first question, trimmed to something listable. */
function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return (clean.length > 60 ? `${clean.slice(0, 57)}…` : clean) || 'New chat';
}

function storedToMessage(m: StoredMessage, i: number): ChatMessage {
  const fromParts = (m.parts ?? [])
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('');
  return {
    id: m.id || `hist-${i}`,
    role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
    content: m.content ?? fromParts ?? '',
    createdAt: m.createdAt,
    blocks: m.blocks,
    thoughts: m.thoughts,
    metadata: m.metadata,
  };
}

/** Only role+content go upstream — the model does not need our render metadata. */
function toWireHistory(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== 'system' && m.content.trim() && !m.error)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));
}

/* ---------------------------------- hook ---------------------------------- */

export function useRagChat({
  sessionId,
  workspaceId,
  onSessionCreated,
  defaults,
}: UseRagChatArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const syncedRef = useRef(false);
  // `defaults` is rebuilt on every render by callers that inline the object;
  // reading it from a ref keeps `send` referentially stable.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  /* ------------------------------ load history ----------------------------- */

  useEffect(() => {
    let cancelled = false;
    abortRef.current?.abort();
    setMessages([]);
    setSuggestions([]);
    setError(null);
    syncedRef.current = false;

    if (!sessionId) return;

    setLoadingHistory(true);
    api
      .get<{ messages?: StoredMessage[] | string } | null>(`chat/sessions/${sessionId}`)
      .then((row) => {
        if (cancelled || !row) return;
        const raw = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
        if (Array.isArray(raw) && raw.length) {
          setMessages(raw.map(storedToMessage));
          syncedRef.current = true;
        }
      })
      .catch(() => {
        // A session id that isn't persisted yet is the normal "new chat" case.
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /* -------------------------------- persist -------------------------------- */

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      const usable = next.filter((m) => m.role !== 'system' && !m.pending);
      if (!usable.length) return;
      const firstUser = usable.find((m) => m.role === 'user');
      try {
        await api.post('chat/sync', {
          session_id: sessionId,
          title: deriveTitle(firstUser?.content ?? ''),
          workspace_id: workspaceId || null,
          messages: usable.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            blocks: m.blocks,
            thoughts: m.thoughts,
            metadata: m.metadata,
          })),
        });
        if (!syncedRef.current) {
          syncedRef.current = true;
          onSessionCreated?.(sessionId);
        }
      } catch {
        // History is a convenience, not the answer. Never surface this.
      }
    },
    [sessionId, workspaceId, onSessionCreated],
  );

  /* ------------------------------ suggestions ------------------------------ */

  const loadSuggestions = useCallback(
    async (query: string, answer: string) => {
      if (!answer.trim()) return;
      try {
        const res = await api.post<{ suggestions?: string[] }>('chat/suggest', {
          query,
          answer: answer.slice(0, 4000),
          workspace_id: workspaceId || null,
          output_lang: defaultsRef.current?.outputLang ?? 'auto',
        });
        setSuggestions((res?.suggestions ?? []).slice(0, 4));
      } catch {
        setSuggestions([]);
      }
    },
    [workspaceId],
  );

  /* --------------------------------- send ---------------------------------- */

  /**
   * `history` is passed explicitly rather than read from state so that
   * regenerate can replay a truncated transcript without waiting for a render.
   */
  const run = useCallback(
    async (question: string, history: ChatMessage[], opts: SendOptions) => {
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantId = uid('a');
      const userMessage: ChatMessage = {
        id: uid('u'),
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };

      setError(null);
      setSuggestions([]);
      setStreaming(true);
      setMessages([
        ...history,
        userMessage,
        { id: assistantId, role: 'assistant', content: '', pending: true, createdAt: new Date().toISOString() },
      ]);

      // Accumulated outside React state: token events arrive faster than
      // renders commit, so a functional setState on every token would still be
      // reading a stale closure for the sync/suggest calls below.
      let answer = '';
      let blocks: RetrievedBlock[] = [];
      let thoughts: ThoughtStep[] = [];
      let metadata: ChatMetadata | undefined;
      const notes: string[] = [];
      let streamError: string | undefined;

      const patch = () =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: answer,
                  blocks: blocks.length ? blocks : m.blocks,
                  thoughts: thoughts.length ? thoughts : m.thoughts,
                  metadata,
                  systemNotes: notes.length ? [...notes] : undefined,
                  error: streamError,
                }
              : m,
          ),
        );

      const onEvent = (evt: StreamEvent) => {
        switch (evt.type) {
          case 'token':
            answer += evt.text ?? '';
            break;

          // A non-streaming provider path returns the whole answer at once.
          case 'answer':
            answer = evt.data ?? evt.text ?? evt.content ?? answer;
            break;

          case 'thought': {
            const step = evt.data ?? { thought: evt.content ?? evt.text };
            if (step && (step.thought || step.action)) thoughts = [...thoughts, step];
            break;
          }

          case 'retrieved_blocks':
            blocks = evt.blocks ?? [];
            break;

          case 'metadata': {
            const { type: _type, sources, reasoning_chain, ...rest } = evt;
            if (sources?.length) blocks = sources;
            if (reasoning_chain?.length) thoughts = reasoning_chain;
            metadata = { ...metadata, ...(rest as ChatMetadata) };
            break;
          }

          case 'system_message':
            if (evt.content) notes.push(evt.content);
            break;

          case 'error':
            streamError = evt.error ?? evt.content ?? 'The model stopped unexpectedly.';
            break;
        }
        patch();
      };

      try {
        await streamNDJSON(
          'search/chat/stream',
          {
            query: question,
            session_id: sessionId,
            workspace_id: workspaceId || null,
            // The backend splits this on commas into a source_urls filter
            // (search.py:22), which is exactly what pinning a source means.
            site_id: opts.pinnedUrls?.length ? opts.pinnedUrls.join(',') : null,
            history: toWireHistory(history),
            output_lang: opts.outputLang ?? 'auto',
            query_notebook: Boolean(opts.queryNotebook),
            persona_id: opts.personaId || null,
            page_content: opts.pageContent || null,
            // Per-request retrieval overrides — null = use server default.
            use_reranking: opts.useReranking ?? null,
            use_graphrag: opts.useGraphrag ?? null,
            use_query_enhancement: opts.useQueryEnhancement ?? null,
          },
          onEvent,
          { signal: controller.signal },
        );
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          // Deliberate stop — keep whatever text arrived.
          if (!answer) answer = '_Stopped._';
        } else {
          streamError =
            err instanceof ApiError ? err.message : (err as Error)?.message || 'Request failed';
          setError(streamError);
        }
      }

      // EOF is the only completion signal this protocol has.
      const finalMessages: ChatMessage[] = [
        ...history,
        userMessage,
        {
          id: assistantId,
          role: 'assistant',
          content: answer,
          createdAt: new Date().toISOString(),
          blocks: blocks.length ? blocks : undefined,
          thoughts: thoughts.length ? thoughts : undefined,
          metadata,
          systemNotes: notes.length ? notes : undefined,
          error: streamError,
          pending: false,
        },
      ];

      setMessages(finalMessages);
      setStreaming(false);
      abortRef.current = null;

      if (!streamError && answer) {
        void persist(finalMessages);
        void loadSuggestions(question, answer);
      }
    },
    [sessionId, workspaceId, persist, loadSuggestions],
  );

  const send = useCallback(
    (question: string, opts: SendOptions = {}) => {
      const text = question.trim();
      if (!text || streaming) return;
      void run(text, messagesRef.current, { ...defaultsRef.current, ...opts });
    },
    [run, streaming],
  );

  /** Re-ask the question that produced `assistantId`, discarding that answer. */
  const regenerate = useCallback(
    (assistantId: string, opts: SendOptions = {}) => {
      if (streaming) return;
      const prev = messagesRef.current;
      const idx = prev.findIndex((m) => m.id === assistantId);
      if (idx < 1) return;
      const question = prev[idx - 1]?.content;
      if (!question) return;
      void run(question, prev.slice(0, idx - 1), { ...defaultsRef.current, ...opts });
    },
    [run, streaming],
  );

  /** Edit a question in place and re-run from there, dropping what followed. */
  const editAndResend = useCallback(
    (userId: string, nextText: string, opts: SendOptions = {}) => {
      const text = nextText.trim();
      if (!text || streaming) return;
      const prev = messagesRef.current;
      const idx = prev.findIndex((m) => m.id === userId);
      if (idx < 0) return;
      void run(text, prev.slice(0, idx), { ...defaultsRef.current, ...opts });
    },
    [run, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Every retrieved block across the transcript, deduped by id. */
  const allBlocks = useCallback((): RetrievedBlock[] => {
    const seen = new Map<string, RetrievedBlock>();
    for (const m of messages) for (const b of m.blocks ?? []) if (!seen.has(b.id)) seen.set(b.id, b);
    return [...seen.values()];
  }, [messages]);

  return {
    messages,
    streaming,
    loadingHistory,
    error,
    suggestions,
    send,
    regenerate,
    editAndResend,
    stop,
    setMessages,
    allBlocks,
    isEmpty: messages.length === 0,
  };
}
