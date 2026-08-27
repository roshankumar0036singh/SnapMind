'use client';

import GeneratorSidebarNav from './generator-sidebar-nav';
import SidebarFooter from '@/components/dashboard/sidebar-footer';
import WorkspaceSwitcher from '@/components/dashboard/workspace-switcher';
import { useCapture } from '@/context/CaptureContext';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, MessageSquarePlus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function GeneratorSidebar({ sidebarOpen }: { sidebarOpen: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { openQuick } = useCapture();

  return (
    <aside
      className={cn(
        'max-lg:absolute inset-y-0 left-0 z-40 flex flex-col relative',
        'bg-white dark:bg-[#131722] border-r border-gray-200 dark:border-white/10',
        'transform transition-all duration-300 ease-in-out lg:translate-x-0 motion-reduce:transition-none',
        isCollapsed ? 'w-[80px]' : 'w-[276px]',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <button
        onClick={() => setIsCollapsed((v) => !v)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-dark-primary border border-gray-200 dark:border-white/15 rounded-full hidden lg:flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 z-50 transition-colors shadow-theme-xs"
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pt-5">
        {/* Workspace + primary actions */}
        <div className={cn('flex flex-col gap-3 pb-4 shrink-0', isCollapsed ? 'px-2' : 'px-4')}>
          <WorkspaceSwitcher isCollapsed={isCollapsed} />

          <div className={cn('flex gap-2', isCollapsed && 'flex-col items-center')}>
            <Link
              href="/text-generator"
              title={isCollapsed ? 'New chat' : undefined}
              className={cn(
                'gradient-btn inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium text-white transition',
                isCollapsed ? 'w-10 h-10' : 'flex-1 h-10 px-3',
              )}
            >
              {isCollapsed ? (
                <MessageSquarePlus className="w-4 h-4" />
              ) : (
                <>
                  <MessageSquarePlus className="w-4 h-4" />
                  New chat
                </>
              )}
            </Link>
            <button
              onClick={openQuick}
              title="Quick capture"
              aria-label="Quick capture"
              className={cn(
                'inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10',
                'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                'hover:bg-gray-50 dark:hover:bg-white/10 transition shrink-0',
                isCollapsed ? 'w-10 h-10' : 'w-10 h-10',
              )}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="shrink-0 border-t border-gray-100 dark:border-white/10">
          <GeneratorSidebarNav isCollapsed={isCollapsed} />
        </div>

        <div className="flex-1" />

        <div className="shrink-0">
          <SidebarFooter isCollapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}
