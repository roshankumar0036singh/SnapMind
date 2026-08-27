/**
 * `/memory` was the template's one-page catch-all: four tabs over the graph, the
 * indexed sites, saved pages and bookmarks. All four now have real pages —
 * `/graph`, `/library` and `/notebook` — each hitting the actual endpoint rather
 * than the `/api/memory` mock this page used.
 *
 * The URL survives because the extension links to it. It lands on Library, which
 * is the bulk of what this page used to show; Graph and Notebook are one click
 * away in the sidebar.
 */

import { redirect } from 'next/navigation';

export default function MemoryPage() {
  redirect('/library');
}
