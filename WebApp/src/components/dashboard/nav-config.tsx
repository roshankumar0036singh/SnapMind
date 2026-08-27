'use client';

import { TextGeneratorIcon } from '@/icons/icons';
import {
  BookMarked,
  Compass,
  FolderSync,
  Image as ImageIcon,
  LayoutDashboard,
  Library,
  MessageSquareText,
  Network,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type NavEntry = {
  href: string;
  label: string;
  /** Short description used by the page headers and (later) the command palette. */
  blurb: string;
  icon: ReactNode;
  /** Accent classes shared by the sidebar icon and the page header badge. */
  accent: string;
};

export type NavGroup = {
  title: string | null;
  items: NavEntry[];
};

const ic = (Icon: LucideIcon, className: string) => <Icon className={`w-5 h-5 ${className}`} />;

/** Single source of truth for dashboard destinations. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      {
        href: '/dashboard',
        label: 'Overview',
        blurb: 'Your knowledge base at a glance',
        icon: ic(LayoutDashboard, 'text-primary-500'),
        accent: 'text-primary-600 bg-primary-50 dark:bg-primary-500/10',
      },
    ],
  },
  {
    title: 'Work',
    items: [
      {
        href: '/text-generator',
        label: 'RAG Chat',
        blurb: 'Ask your indexed knowledge, with citations',
        icon: ic(MessageSquareText, 'text-primary-500'),
        accent: 'text-primary-600 bg-primary-50 dark:bg-primary-500/10',
      },
      {
        href: '/vision',
        label: 'Vision',
        blurb: 'Analyse screenshots, diagrams and scans',
        icon: ic(ImageIcon, 'text-amber-500'),
        accent: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
      },
      {
        href: '/research',
        label: 'Research',
        blurb: 'Autonomous web research agents',
        icon: ic(Compass, 'text-rose-500'),
        accent: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10',
      },
      {
        href: '/capture',
        label: 'Capture',
        blurb: 'Add pages, files, repos and notes',
        icon: ic(Sparkles, 'text-violet-500'),
        accent: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10',
      },
    ],
  },
  {
    title: 'Knowledge',
    items: [
      {
        href: '/library',
        label: 'Library',
        blurb: 'Everything you have indexed',
        icon: ic(Library, 'text-emerald-500'),
        accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
      },
      {
        href: '/notebook',
        label: 'Notebook',
        blurb: 'Saved snippets and semantic bookmarks',
        icon: ic(BookMarked, 'text-sky-500'),
        accent: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10',
      },
      {
        href: '/graph',
        label: 'Graph',
        blurb: 'Entities and relationships across sources',
        icon: ic(Network, 'text-fuchsia-500'),
        accent: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-500/10',
      },
    ],
  },
  {
    title: 'Manage',
    items: [
      {
        href: '/workspaces',
        label: 'Workspaces',
        blurb: 'Separate projects and their sources',
        icon: ic(FolderSync, 'text-indigo-500'),
        accent: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10',
      },
      {
        href: '/settings',
        label: 'Settings',
        blurb: 'Providers, API keys and retrieval',
        icon: ic(Settings, 'text-gray-400'),
        accent: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-white/10',
      },
    ],
  },
];

export const NAV_ITEMS: NavEntry[] = NAV_GROUPS.flatMap((g) => g.items);

export function navEntryFor(pathname: string): NavEntry | undefined {
  // Longest match wins so /text-generator/[chatId] resolves to RAG Chat.
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
}
