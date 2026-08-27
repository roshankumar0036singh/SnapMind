'use client';

import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, FolderSync, Plus, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CreateWorkspaceModal } from '@/components/workspaces/CreateWorkspaceModal';

export default function WorkspaceSwitcher({ isCollapsed }: { isCollapsed?: boolean }) {
  const { workspaces, activeWorkspace, setActiveWorkspace, isLoading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Collapsed, there is no width for a dropdown — a 40px anchor would open a
  // 40px-wide list. It links to the workspaces page instead, which is where
  // switching, counts and defaults all live anyway.
  if (isCollapsed) {
    return (
      <Link
        href="/workspaces"
        title={
          activeWorkspace ? `Workspace: ${activeWorkspace.name} — switch` : 'Choose a workspace'
        }
        className="w-10 h-10 mx-auto rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center transition hover:bg-primary-100 dark:hover:bg-primary-500/25 focus-visible:outline-none focus-visible:shadow-ring"
      >
        <FolderSync className="w-5 h-5" />
        <span className="sr-only">
          {activeWorkspace ? `Workspace: ${activeWorkspace.name}` : 'Workspaces'}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition',
            'border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5',
            'hover:bg-gray-50 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:shadow-ring',
          )}
        >
          <span className="w-7 h-7 shrink-0 rounded-lg dashboard-gradient text-white flex items-center justify-center text-[11px] font-semibold">
            {(activeWorkspace?.name ?? 'W').slice(0, 2).toUpperCase()}
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Workspace
            </span>
            <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
              {isLoading ? 'Loading…' : (activeWorkspace?.name ?? 'No workspace')}
            </span>
          </span>
          <ChevronsUpDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-dark-primary shadow-theme-lg overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
              {workspaces.length === 0 && (
                <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                  No workspaces yet.
                </p>
              )}
              {workspaces.map((w) => {
                const active = w.id === activeWorkspace?.id;
                return (
                  <button
                    key={w.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setActiveWorkspace(w);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition',
                      active
                        ? 'bg-primary-50 dark:bg-white/10'
                        : 'hover:bg-gray-50 dark:hover:bg-white/5',
                    )}
                  >
                    <span className="w-6 h-6 shrink-0 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 flex items-center justify-center text-[10px] font-semibold">
                      {w.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate">
                      {w.name}
                    </span>
                    {active && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center border-t border-gray-100 dark:border-white/10">
              <button
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                className="flex flex-1 items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-300 hover:bg-gray-50 dark:hover:bg-white/5 transition"
              >
                <Plus className="w-4 h-4" />
                New workspace
              </button>
              <Link
                href="/workspaces"
                onClick={() => setOpen(false)}
                title="Manage workspaces"
                className="flex items-center gap-1.5 border-l border-gray-100 dark:border-white/10 px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Manage
              </Link>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <CreateWorkspaceModal isOpen={creating} onClose={() => setCreating(false)} />
      )}
    </>
  );
}
