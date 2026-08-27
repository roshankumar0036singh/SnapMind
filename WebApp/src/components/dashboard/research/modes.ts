'use client';

/**
 * The seven research modes.
 *
 * Each one is a distinct backend route with its own contract, not a variation of
 * a single call, which is why they get separate forms rather than one query box
 * with a dropdown. `blurb` is what the mode does; `caveat` is what it costs you
 * — latency, provider keys, or a limitation the backend cannot work around — and
 * it is shown next to the form rather than buried, because every mode here is
 * slow enough that finding out afterwards is annoying.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  FileText,
  Globe,
  Languages,
  Route,
  Scale,
  UserSearch,
} from 'lucide-react';

export type ResearchModeId =
  | 'browser'
  | 'deep'
  | 'report'
  | 'debate'
  | 'person'
  | 'lingual'
  | 'scrape';

export type ModeDef = {
  id: ResearchModeId;
  label: string;
  icon: LucideIcon;
  /** Sidebar-style accent, following the convention in nav-config.tsx. */
  accent: string;
  blurb: string;
};

export const MODES: ModeDef[] = [
  {
    id: 'browser',
    label: 'Browser Mode',
    icon: Compass,
    accent: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10',
    blurb: 'Searches the live web, reads what it finds, and answers with citations',
  },
  {
    id: 'deep',
    label: 'Deep Research',
    icon: Route,
    accent: 'text-primary-600 bg-primary-50 dark:bg-primary-500/10',
    blurb: 'Splits a hard question into steps and researches each one in turn',
  },
  {
    id: 'report',
    label: 'Report',
    icon: FileText,
    accent: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
    blurb: 'Turns finished research sessions into a formal DOCX paper',
  },
  {
    id: 'debate',
    label: 'Debate',
    icon: Scale,
    accent: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    blurb: 'Argues a claim both ways, then moderates between the two',
  },
  {
    id: 'person',
    label: 'Person',
    icon: UserSearch,
    accent: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10',
    blurb: 'Profiles a person from public sources, with a LinkedIn importer',
  },
  {
    id: 'lingual',
    label: 'Cross-lingual',
    icon: Languages,
    accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    blurb: 'Searches in another language and answers back in yours',
  },
  {
    id: 'scrape',
    label: 'Scrape',
    icon: Globe,
    accent: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10',
    blurb: 'Reads one page into clean Markdown, without indexing it',
  },
];

export function modeById(id?: string | null): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
