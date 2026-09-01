'use client';

/**
 * The active workspace, which almost every request in the dashboard is scoped by.
 *
 * Three things worth knowing about the shape of this file:
 *
 * 1. **The active workspace is stored as an id, not an object.** Holding the row
 *    itself meant a stale copy could outlive a refresh — the old code carried a
 *    `'1111…'` dummy-id workaround for exactly that. Deriving the object from
 *    `workspaces` on every render makes staleness impossible.
 * 2. **The choice is persisted to localStorage**, so a reload doesn't silently
 *    drop you back into whichever workspace happens to sort first. If the stored
 *    id no longer exists (deleted elsewhere, different account), the reconcile
 *    effect falls back to the first workspace.
 * 3. **Reads and creates go through `/api/workspaces`** (a Next route that talks
 *    to Postgres directly with the service-role key) while **deletes go through
 *    the FastAPI backend** at `DELETE /api/v1/workspaces/{id}`, because that is
 *    where the `owner_id` check lives — `workspace_repository.delete` matches on
 *    both id and owner. There is no update route on either side, which is why
 *    this context offers no rename.
 */

import { api } from '@/lib/api-client';
import type { Workspace } from '@/lib/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ACTIVE_STORAGE = 'snapmind.workspace.active';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
  /** Creates, refreshes the list, and makes the new workspace active. */
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  /** Throws on failure so the caller can surface the server's message. */
  deleteWorkspace: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

/**
 * The row as Postgres stores it. `description` is not a column — it lives inside
 * the write-once `metadata` blob — so it is lifted out here rather than in every
 * component that wants to show it.
 */
function normalize(input: unknown): Workspace | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : undefined;
  if (!id) return null;

  const metadata = (row.metadata && typeof row.metadata === 'object'
    ? (row.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const fromMeta = typeof metadata.description === 'string' ? metadata.description : undefined;
  const fromRow = typeof row.description === 'string' ? row.description : undefined;
  const name = typeof row.name === 'string' && row.name.trim() ? row.name : 'Untitled workspace';

  return {
    id,
    name,
    description: fromMeta || fromRow || undefined,
    owner_id: typeof row.owner_id === 'string' ? row.owner_id : undefined,
    metadata,
    created_at:
      typeof row.created_at === 'string'
        ? row.created_at
        : typeof row.createdAt === 'string'
          ? row.createdAt
          : undefined,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const remember = useCallback((id: string | null) => {
    setActiveId(id);
    try {
      if (id) window.localStorage.setItem(ACTIVE_STORAGE, id);
      else window.localStorage.removeItem(ACTIVE_STORAGE);
    } catch {
      /* private mode or blocked storage — the choice just won't survive a reload */
    }
  }, []);

  const load = useCallback(async (): Promise<Workspace[]> => {
    const response = await fetch('/api/workspaces');
    if (!response.ok) {
      throw new Error((await response.text()) || `Could not load workspaces (${response.status})`);
    }
    const payload = (await response.json()) as unknown;
    return Array.isArray(payload)
      ? payload.map(normalize).filter((w): w is Workspace => w !== null)
      : [];
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await load();
      setWorkspaces(list);
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [load]);

  // Restore the last choice before the first fetch resolves, so the switcher
  // doesn't flash the wrong name and then correct itself.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ACTIVE_STORAGE);
      if (saved) setActiveId(saved);
    } catch {
      /* ignore */
    }
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Reconcile: whatever we restored (or had selected) must exist in the list.
  useEffect(() => {
    if (isLoading) return;
    if (workspaces.length === 0) {
      if (activeId) remember(null);
      return;
    }
    if (activeId && workspaces.some((w) => w.id === activeId)) return;
    remember(workspaces[0].id);
  }, [workspaces, activeId, isLoading, remember]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId],
  );

  const setActiveWorkspace = useCallback(
    (workspace: Workspace | null) => remember(workspace?.id ?? null),
    [remember],
  );

  const createWorkspace = useCallback(
    async (name: string, description?: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the workspace a name');

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          // `metadata` is written once at creation — there is no update route, so
          // this description is final.
          metadata: description?.trim() ? { description: description.trim() } : {},
        }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || `Could not create the workspace (${response.status})`);
      }

      const created = normalize(await response.json());
      if (!created) throw new Error('The workspace was created but came back in an unexpected shape');

      setWorkspaces((prev) => [created, ...prev.filter((w) => w.id !== created.id)]);
      remember(created.id);
      return created;
    },
    [remember],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      // Through the FastAPI proxy, not /api/workspaces — the ownership check is
      // on the backend route and /api/workspaces has no DELETE handler.
      await api.del(`workspaces/${id}`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    },
    [],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      isLoading,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace,
    }),
    [
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      isLoading,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
