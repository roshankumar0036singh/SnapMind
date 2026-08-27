'use client';

/**
 * Answers — how a question gets turned into an answer.
 *
 * Three things live here because they all change the *content* of a reply rather
 * than the look of the app: which retrieval stages run, what language the answer
 * comes back in, and which persona writes it.
 *
 * The retrieval switches are account defaults, and the chat composer holds the
 * same three so a single question can differ. Both read SettingsContext, so
 * they can never disagree. Each one maps to a field on the chat request
 * (`use_reranking`, `use_graphrag`, `use_query_enhancement`) — the backend has its
 * own configured default for each, and these override it per request.
 *
 * Language is edited on `globalPrefs`, not the merged `prefs`, because a
 * workspace can override it; when the active one does, the note says so instead
 * of silently writing a default the reader won't see take effect.
 */

import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  FIELD,
  IconButton,
  INSET,
  Panel,
  Pill,
  SectionHeader,
  Select,
  Skeleton,
  Toggle,
} from '@/components/dashboard/ui';
import { OUTPUT_LANGUAGES, useSettings, type RetrievalPrefs } from '@/context/SettingsContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import type { Persona } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Plus, Theater, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const RETRIEVAL: {
  id: keyof Omit<RetrievalPrefs, 'queryNotebook'>;
  label: string;
  hint: string;
}[] = [
  {
    id: 'reranking',
    label: 'Rerank results',
    hint: 'Pulls a wider set of candidates, then scores them a second time and keeps only the best. One extra model call per question, and the single biggest win for accuracy.',
  },
  {
    id: 'graphRag',
    label: 'Use the knowledge graph',
    hint: 'Adds how the entities in your question relate to one another alongside the matching passages. Worth it for "how does X connect to Y" questions; noise for simple lookups.',
  },
  {
    id: 'queryEnhancement',
    label: 'Expand the question',
    hint: 'Searches several rephrasings as well as your own wording, so a passage that says the same thing in different words still surfaces. Slowest of the three.',
  },
];

export default function AnswersPanel() {
  const { prefs, globalPrefs, setPrefs, setRetrieval, workspacePrefs } = useSettings();
  const { activeWorkspace } = useWorkspace();

  const langOverridden = workspacePrefs.outputLang !== undefined;

  return (
    <div className="space-y-6">
      <Panel>
        <SectionHeader
          title="Retrieval"
          description="Each stage costs time and a model call. These are your defaults — the composer can change them for one question."
        />
        <div className="space-y-5">
          {RETRIEVAL.map((r) => (
            <Toggle
              key={r.id}
              label={r.label}
              hint={r.hint}
              checked={globalPrefs.retrieval[r.id]}
              onChange={(v) => setRetrieval({ [r.id]: v } as Partial<RetrievalPrefs>)}
            />
          ))}
          <div className="border-t border-gray-100 pt-5 dark:border-white/10">
            <Toggle
              label="Search my notebook too"
              hint="Includes the pages and highlights you saved, cited as nb-block-N so you can tell them from indexed sources."
              checked={globalPrefs.retrieval.queryNotebook}
              onChange={(v) => setRetrieval({ queryNotebook: v })}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title="Answer language"
          description="Applies to the answer, not the search — your sources are found in whatever language they were written in."
        />
        <Select
          label="Answer language"
          value={globalPrefs.outputLang}
          onChange={(v) => setPrefs({ outputLang: v })}
          options={OUTPUT_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
          className="max-w-sm"
        />
        {langOverridden && (
          <p className="mt-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
            {activeWorkspace?.name ?? 'The active workspace'} overrides this with{' '}
            <strong className="font-semibold">
              {OUTPUT_LANGUAGES.find((l) => l.value === prefs.outputLang)?.label ??
                prefs.outputLang}
            </strong>
            , so changing it here won&apos;t affect answers until you clear that override in
            Workspaces.
          </p>
        )}
      </Panel>

      <PersonasPanel />
    </div>
  );
}

/* -------------------------------- personas -------------------------------- */

function PersonasPanel() {
  const { globalPrefs, setPrefs } = useSettings();
  const { activeWorkspace } = useWorkspace();

  // No workspace_id on this request: Settings manages every persona the account
  // owns, where the composer only offers the ones in scope for its workspace.
  const personas = useApi<Persona[]>(async (signal) => {
    const res = await api.get<{ success?: boolean; personas?: Persona[] } | Persona[]>('personas', {
      signal,
    });
    return Array.isArray(res) ? res : (res?.personas ?? []);
  }, []);

  const [name, setName] = useState('');
  const [addon, setAddon] = useState('');
  const [scoped, setScoped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Persona | null>(null);
  const [deleting, setDeleting] = useState(false);

  const list = personas.data ?? [];
  const canSave = name.trim().length > 0 && addon.trim().length > 0;

  const create = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await api.post('personas', {
        name: name.trim(),
        system_prompt_addon: addon.trim(),
        workspace_id: scoped ? (activeWorkspace?.id ?? null) : null,
      });
      setName('');
      setAddon('');
      setScoped(false);
      void personas.reload();
      toast.success('Persona saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the persona');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.del(`personas/${pendingDelete.id}`);
      personas.setData(list.filter((p) => p.id !== pendingDelete.id));
      // A deleted persona must not stay selected, or every answer silently loses
      // its voice with the picker still claiming otherwise.
      if (globalPrefs.personaId === pendingDelete.id) setPrefs({ personaId: null });
      toast.success('Persona deleted');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the persona');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Panel>
        <SectionHeader
          title="Personas"
          description="Extra instructions bolted onto the assistant's prompt — a tone, an audience, a house style. Citations stay mandatory whatever a persona says."
          action={
            <Button variant="ghost" size="sm" onClick={personas.reload} loading={personas.loading}>
              Refresh
            </Button>
          }
        />

        {personas.error ? (
          <ErrorNote message={personas.error} onRetry={personas.reload} />
        ) : personas.loading && !personas.data ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Theater className="h-7 w-7" />}
            title="No personas yet"
            description="Write one below — a sentence or two is usually enough to change how answers read."
          />
        ) : (
          <ul className="space-y-2">
            {list.map((p) => {
              const selected = globalPrefs.personaId === p.id;
              return (
                <li key={p.id} className={cn(INSET, 'flex items-start justify-between gap-3 px-4 py-3')}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white/90">
                        {p.name}
                      </span>
                      {selected && <Pill tone="brand">Default</Pill>}
                      {p.workspace_id && <Pill tone="neutral">One workspace</Pill>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
                      {p.system_prompt_addon}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant={selected ? 'soft' : 'ghost'}
                      size="sm"
                      onClick={() => setPrefs({ personaId: selected ? null : p.id })}
                    >
                      {selected ? 'Unset' : 'Use'}
                    </Button>
                    <IconButton
                      icon={<Trash2 className="h-4 w-4" />}
                      label={`Delete ${p.name}`}
                      onClick={() => setPendingDelete(p)}
                      className="hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10 dark:hover:text-error-500"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          title="New persona"
          description="Written in the second person, as an instruction to the assistant."
        />
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name — e.g. Plain English"
            maxLength={60}
            className={cn(FIELD, 'max-w-sm')}
          />
          <textarea
            value={addon}
            onChange={(e) => setAddon(e.target.value)}
            rows={4}
            placeholder="Explain things the way you would to a smart colleague outside the field. Short sentences, no jargon without a definition, and lead with the conclusion."
            maxLength={2000}
            className={cn(FIELD, 'resize-y leading-relaxed')}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {activeWorkspace ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={scoped}
                  onChange={setScoped}
                  label={`Only offer this persona in ${activeWorkspace.name}`}
                />
                {/* Redundant with the checkbox for keyboard users, so a span is
                    enough — it just widens the hit area for pointers. */}
                <span
                  onClick={() => setScoped((v) => !v)}
                  className="cursor-pointer text-[12.5px] text-gray-600 dark:text-gray-300"
                >
                  Only offer it in {activeWorkspace.name}
                </span>
              </div>
            ) : (
              <span />
            )}
            <Button variant="gradient" onClick={create} loading={saving} disabled={!canSave}>
              <Plus className="h-4 w-4" />
              Save persona
            </Button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={deleting}
        title={`Delete ${pendingDelete?.name ?? 'this persona'}?`}
        description="Answers go back to the default voice. Nothing in your knowledge base changes."
        confirmLabel="Delete persona"
      />
    </>
  );
}
