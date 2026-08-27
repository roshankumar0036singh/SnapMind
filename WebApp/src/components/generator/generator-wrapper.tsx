'use client';

import CaptureQueue from '@/components/dashboard/capture/capture-queue';
import QuickCapture from '@/components/dashboard/capture/quick-capture';
import { navEntryFor } from '@/components/dashboard/nav-config';
import { useCapture } from '@/context/CaptureContext';
import { cn } from '@/lib/utils';
import { History, Menu, Plus, UploadCloud } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, Suspense, type DragEvent } from 'react';
import GeneratorSidebar from './sidebar/generator-sidebar';
import RightSidebar from './sidebar/chat-history-sidebar';

/** Routes that get the chat-history rail on the right. */
const CHAT_ROUTES = ['/text-generator'];

export default function GeneratorWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ingestFiles, openQuick } = useCapture();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const showRightRail = CHAT_ROUTES.some((r) => pathname.startsWith(r));
  const current = navEntryFor(pathname);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // The chat rail belongs open on a desktop, but below xl it overlays the
  // transcript — so it only auto-opens where there is room for it. Done in an
  // effect rather than in the initial state so SSR and the client agree.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) setRightSidebarOpen(true);
  }, []);

  /* ------------------------- drop files anywhere ------------------------- */

  const hasFiles = (e: DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDropActive(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear when the pointer actually leaves the shell, not a child.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropActive(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) void ingestFiles(files);
    },
    [ingestFiles],
  );

  return (
    <div
      className="flex h-screen overflow-hidden bg-white dark:bg-dark-secondary"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className={cn(
          'isolate relative grid w-full h-full min-h-0 grid-rows-[100%]',
          showRightRail ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[auto_1fr]',
        )}
      >
        <GeneratorSidebar sidebarOpen={sidebarOpen} />

        <div className="flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
          {/* Mobile top bar — the sidebar is a drawer below lg. */}
          <header className="lg:hidden flex items-center gap-3 px-4 h-14 shrink-0 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-dark-secondary">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="w-9 h-9 -ml-1.5 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate">
              {current?.label ?? 'SnapMind'}
            </span>
            {showRightRail && (
              <button
                onClick={() => setRightSidebarOpen((v) => !v)}
                aria-label="Chat history"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                <History className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={openQuick}
              aria-label="Quick capture"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"
            >
              <Plus className="w-5 h-5" />
            </button>
          </header>

          <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">{children}</div>
        </div>

        {showRightRail && (
          // Suspense because the rail reads `?id=` with useSearchParams, which
          // needs a boundary to keep the rest of the shell prerenderable.
          <Suspense fallback={null}>
            <RightSidebar
              isOpen={rightSidebarOpen}
              toggleIsOpen={() => setRightSidebarOpen((v) => !v)}
            />
          </Suspense>
        )}

        {/* Overlays */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-gray-900/60 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {rightSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm xl:hidden"
            aria-hidden="true"
            onClick={() => setRightSidebarOpen(false)}
          />
        )}
      </div>

      {/* Drop-anywhere affordance */}
      {dropActive && (
        <div className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center bg-primary-600/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 px-8 py-7 rounded-3xl bg-white dark:bg-dark-primary border-2 border-dashed border-primary-400 dark:border-primary-500/60 shadow-theme-lg">
            <UploadCloud className="w-8 h-8 text-primary-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Drop to add to your library
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PDF, DOCX, CSV, TXT and Markdown
            </p>
          </div>
        </div>
      )}

      <QuickCapture />
      <CaptureQueue />
    </div>
  );
}
