'use client';

/**
 * Knowledge graph.
 *
 * What the API actually gives us, and what that forces:
 *
 * - All three graph routes emit **Cytoscape-shaped** payloads (`{data: {...}}`
 *   wrappers) while `react-force-graph-2d` wants `{nodes, links}` with `source`/
 *   `target` — so there is a conversion step, and it drops edges whose endpoints
 *   are missing rather than handing force-graph a dangling reference (which
 *   throws).
 * - `GET graph/data` filters by `user_id` only (`graph.py`) — there is **no
 *   workspace filter**, so this view is account-wide no matter what the
 *   workspace switcher says. That is stated on screen rather than papered over.
 * - The same route returns only nodes that appear in an edge; isolated entities
 *   never reach the client. Worth knowing before concluding an entity is missing.
 * - `edges.source_url` is read from the database but left out of the response, so
 *   a node cannot be traced back to its documents here. The detail panel offers
 *   its neighbours and a jump into chat instead of inventing a provenance list.
 *
 * Node objects are created **once per payload** and then filtered by reference,
 * so hiding a type re-runs the simulation from the existing positions instead of
 * throwing the layout away and re-scattering everything.
 */

import TypeLegend, { GlyphSwatch } from '@/components/dashboard/graph/legend';
import {
  Button,
  EmptyState,
  ErrorNote,
  IconButton,
  PageHeader,
  Panel,
  Pill,
  SearchInput,
  Select,
  Spinner,
  Toggle,
} from '@/components/dashboard/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import { compactNumber } from '@/lib/format';
import {
  assignTypes,
  CANVAS_INK,
  drawGlyph,
  labelType,
  normaliseType,
  OTHER_SLOT,
  type Slot,
} from '@/lib/graph-palette';
import type { GraphPayload, GraphSession } from '@/lib/types';
import {
  Crosshair,
  Download,
  Info,
  Maximize,
  MessageSquare,
  Network,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

/* ---------------------------------- model --------------------------------- */

type GNode = {
  id: string;
  label: string;
  /** Normalised entity type — the palette key. */
  type: string;
  degree: number;
  /** Written by the force simulation. */
  x?: number;
  y?: number;
};

type GLink = {
  source: string | GNode;
  target: string | GNode;
  /** Kept separately because force-graph replaces `source`/`target` with node
   *  objects in place, and our own filtering must not depend on that. */
  sourceId: string;
  targetId: string;
  relation: string;
};

type Graph = {
  nodes: GNode[];
  links: GLink[];
  /** id → neighbours, for the detail panel. */
  neighbours: Map<string, { id: string; label: string; relation: string }[]>;
  typeCounts: Map<string, number>;
  relationCounts: Map<string, number>;
  /** Edges dropped for pointing at a node that was not in the payload. */
  dangling: number;
};

const EMPTY: Graph = {
  nodes: [],
  links: [],
  neighbours: new Map(),
  typeCounts: new Map(),
  relationCounts: new Map(),
  dangling: 0,
};

/** Cytoscape payload → force-graph shape, in one pass per collection. */
function toGraph(payload?: GraphPayload | null): Graph {
  if (!payload?.nodes) return EMPTY;

  const nodes: GNode[] = [];
  const byId = new Map<string, GNode>();
  const typeCounts = new Map<string, number>();

  for (const raw of payload.nodes) {
    const d = raw?.data;
    if (!d?.id) continue;
    const id = String(d.id);
    if (byId.has(id)) continue;
    const type = normaliseType(d.type);
    const node: GNode = { id, label: d.label || id, type, degree: 0 };
    nodes.push(node);
    byId.set(id, node);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const links: GLink[] = [];
  const neighbours = new Map<string, { id: string; label: string; relation: string }[]>();
  const relationCounts = new Map<string, number>();
  let dangling = 0;

  const push = (from: string, to: GNode, relation: string) => {
    const list = neighbours.get(from) ?? [];
    list.push({ id: to.id, label: to.label, relation });
    neighbours.set(from, list);
  };

  for (const raw of payload.edges ?? []) {
    const d = raw?.data;
    if (!d?.source || !d?.target) continue;
    const sourceId = String(d.source);
    const targetId = String(d.target);
    // Self-loops are dropped without counting: they are an extraction artefact
    // ("X relates to X"), not a sign the payload was inconsistent.
    if (sourceId === targetId) continue;

    const a = byId.get(sourceId);
    const b = byId.get(targetId);
    if (!a || !b) {
      dangling++;
      continue;
    }

    const relation = (d.label ?? '').trim();
    links.push({ source: sourceId, target: targetId, sourceId, targetId, relation });
    a.degree++;
    b.degree++;
    push(sourceId, b, relation);
    push(targetId, a, relation);
    if (relation) relationCounts.set(relation, (relationCounts.get(relation) ?? 0) + 1);
  }

  return { nodes, links, neighbours, typeCounts, relationCounts, dangling };
}

const radiusOf = (n: GNode) => 3.2 + Math.min(8, Math.sqrt(n.degree) * 2.2);

/* ---------------------------------- page ---------------------------------- */

export default function GraphPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  // Colours are baked into canvas draw calls, so the first paint has to happen
  // after the theme is known rather than guessing light and repainting.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  const ink = dark ? CANVAS_INK.dark : CANVAS_INK.light;

  /* -------------------------------- data -------------------------------- */

  const [scope, setScope] = useState('all');

  const sessions = useApi<GraphSession[] | { sessions?: GraphSession[] }>(
    () => api.get('graph/sessions'),
    [],
  );
  const sessionRows: GraphSession[] = Array.isArray(sessions.data)
    ? sessions.data
    : (sessions.data?.sessions ?? []);

  const source = useApi<GraphPayload>(
    () => api.get(scope === 'all' ? 'graph/data' : `graph/session/${encodeURIComponent(scope)}`),
    [scope],
  );

  const graph = useMemo(() => toGraph(source.data), [source.data]);
  const types = useMemo(() => assignTypes(graph.typeCounts), [graph.typeCounts]);

  /* ------------------------------- filters ------------------------------- */

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [relation, setRelation] = useState('all');
  const [hideUnconnected, setHideUnconnected] = useState(false);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A new payload invalidates every id-based bit of UI state.
  useEffect(() => {
    setHidden(new Set());
    setRelation('all');
    setSelectedId(null);
  }, [source.data]);

  const toggleType = useCallback((type: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const soloType = useCallback(
    (type: string) => setHidden(new Set(types.entries.map((e) => e.type).filter((t) => t !== type))),
    [types.entries],
  );

  const relationOptions = useMemo(() => {
    const rows = [...graph.relationCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 60);
    return [
      { value: 'all', label: `All relations (${compactNumber(graph.links.length)})` },
      ...rows.map(([rel, n]) => ({ value: rel, label: `${rel} · ${n}` })),
    ];
  }, [graph.relationCounts, graph.links.length]);

  /** The graph actually handed to the canvas. Same object identities as `graph`. */
  const view = useMemo(() => {
    const visible = new Set(
      graph.nodes.filter((n) => !hidden.has(n.type)).map((n) => n.id),
    );

    let links = graph.links.filter(
      (l) => visible.has(l.sourceId) && visible.has(l.targetId),
    );
    if (relation !== 'all') links = links.filter((l) => l.relation === relation);

    let nodes = graph.nodes.filter((n) => visible.has(n.id));

    // Narrowing to one relation leaves most entities with nothing attached, and a
    // field of unconnected dots is not the answer to "show me who reports to whom" —
    // so a relation filter implies the unconnected drop as well.
    if (hideUnconnected || relation !== 'all') {
      const touched = new Set<string>();
      for (const l of links) {
        touched.add(l.sourceId);
        touched.add(l.targetId);
      }
      nodes = nodes.filter((n) => touched.has(n.id));
    }

    return { nodes, links };
  }, [graph, hidden, relation, hideUnconnected]);

  /* ------------------------- search, focus, selection ------------------------- */

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return new Set(
      view.nodes.filter((n) => n.label.toLowerCase().includes(needle)).map((n) => n.id),
    );
  }, [q, view.nodes]);

  const selected = useMemo(
    () => (selectedId ? view.nodes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, view.nodes],
  );

  /** Nodes to keep at full strength; everything else is dimmed. */
  const focusIds = useMemo(() => {
    if (selected) {
      const set = new Set<string>([selected.id]);
      for (const nb of graph.neighbours.get(selected.id) ?? []) set.add(nb.id);
      return set;
    }
    return matches;
  }, [selected, matches, graph.neighbours]);

  /* -------------------------------- canvas -------------------------------- */

  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Measure the container instead of deriving from window size minus a
  // hardcoded sidebar width — the shell's rails collapse and the old arithmetic
  // was wrong at every breakpoint but one.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const r = entry.contentRect;
      setSize({ w: Math.max(0, Math.round(r.width)), h: Math.max(0, Math.round(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Imported through state rather than `next/dynamic` because this component
  // needs a ref (centerAt/zoom/zoomToFit) and next/dynamic does not forward one.
  const [FG, setFG] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    void import('react-force-graph-2d').then((m) => {
      if (alive) setFG(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, []);

  const focusNode = useCallback((node: GNode | null | undefined) => {
    if (!node || node.x == null || node.y == null) return;
    fgRef.current?.centerAt(node.x, node.y, 500);
    fgRef.current?.zoom(2.4, 500);
  }, []);

  const onSearchEnter = () => {
    if (!matches?.size) return;
    // Shortest label wins — with "data" typed, "Data" beats "Data governance".
    const best = view.nodes
      .filter((n) => matches.has(n.id))
      .sort((a, b) => a.label.length - b.label.length)[0];
    setSelectedId(best?.id ?? null);
    focusNode(best);
  };

  const slotFor = useCallback((type: string): Slot => types.slotOf(type) ?? OTHER_SLOT, [types]);

  const paintNode = useCallback(
    (node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
      if (node.x == null || node.y == null) return;
      const px = 1 / scale;
      const slot = slotFor(node.type);
      const colour = dark ? slot.dark : slot.light;
      const r = radiusOf(node);
      const dim = focusIds ? !focusIds.has(node.id) : false;
      const isSelected = node.id === selectedId;

      ctx.save();
      ctx.globalAlpha = dim ? 0.16 : 1;

      // Surface-coloured halo first: it becomes the 2px gap between marks that
      // overlap, which is what keeps a dense cluster legible.
      ctx.fillStyle = ink.halo;
      drawGlyph(ctx, slot.shape, node.x, node.y, r + 1.8 * px);

      ctx.fillStyle = colour;
      drawGlyph(ctx, slot.shape, node.x, node.y, r);

      if (isSelected) {
        // Selection is geometry, never a hue — a coloured ring would read as a
        // ninth entity type.
        ctx.strokeStyle = ink.label;
        ctx.lineWidth = 1.6 * px;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4 * px, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Label the nodes worth labelling rather than all of them: hubs, whatever
      // is in focus, and everything once you have zoomed in.
      const show = isSelected || (focusIds?.has(node.id) ?? false) || scale > 1.6 || node.degree >= 6;
      if (show) {
        const fontSize = Math.min(13, 11 * px * scale) / scale;
        ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const text = node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label;

        // Outline the text in the surface colour so it survives crossing an edge.
        ctx.lineWidth = 2.4 * px;
        ctx.strokeStyle = ink.halo;
        ctx.strokeText(text, node.x, node.y + r + 2.5 * px);
        ctx.fillStyle = isSelected ? ink.label : ink.labelSecondary;
        ctx.fillText(text, node.x, node.y + r + 2.5 * px);
      }

      ctx.restore();
    },
    [dark, focusIds, ink, selectedId, slotFor],
  );

  const paintPointerArea = useCallback(
    (node: GNode, colour: string, ctx: CanvasRenderingContext2D) => {
      if (node.x == null || node.y == null) return;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radiusOf(node) + 3, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  const linkIncidentToSelection = useCallback(
    (l: GLink) => Boolean(selectedId) && (l.sourceId === selectedId || l.targetId === selectedId),
    [selectedId],
  );

  /** Relation labels only on the selected node's edges — all of them at once is noise. */
  const paintLink = useCallback(
    (l: GLink, ctx: CanvasRenderingContext2D, scale: number) => {
      if (!l.relation || !linkIncidentToSelection(l)) return;
      const a = l.source as GNode;
      const b = l.target as GNode;
      if (typeof a !== 'object' || typeof b !== 'object' || a.x == null || b.x == null) return;

      const px = 1 / scale;
      const mx = (a.x! + b.x!) / 2;
      const my = (a.y! + b.y!) / 2;
      const fontSize = Math.min(11, 9.5 * px * scale) / scale;

      ctx.save();
      ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = l.relation.length > 26 ? `${l.relation.slice(0, 25)}…` : l.relation;
      const w = ctx.measureText(text).width;

      ctx.fillStyle = ink.halo;
      ctx.fillRect(mx - w / 2 - 2 * px, my - fontSize * 0.72, w + 4 * px, fontSize * 1.45);
      ctx.fillStyle = ink.labelSecondary;
      ctx.fillText(text, mx, my);
      ctx.restore();
    },
    [ink, linkIncidentToSelection],
  );

  /* ------------------------------- PNG export ------------------------------- */

  const exportPng = useCallback(() => {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) {
      toast.error('Nothing to export yet');
      return;
    }
    try {
      // The force-graph canvas is transparent, so a straight toDataURL gives a
      // PNG that is invisible on anything but the app's own background.
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = ink.surface;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0);

      const a = document.createElement('a');
      a.href = out.toDataURL('image/png');
      a.download = `snapmind-graph${scope === 'all' ? '' : `-${scope.slice(0, 12)}`}.png`;
      a.click();
    } catch {
      toast.error('Could not export the graph');
    }
  }, [ink.surface, scope]);

  /* --------------------------------- view --------------------------------- */

  const scopeOptions = useMemo(
    () => [
      { value: 'all', label: 'Everything' },
      ...sessionRows.map((s) => ({
        value: s.session_id,
        label: `${s.title || 'Untitled chat'} · ${s.node_count} entities`,
      })),
    ],
    [sessionRows],
  );

  const loading = source.loading && !source.data;
  const isEmpty = !loading && !source.error && graph.nodes.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 sm:px-6">
        <PageHeader
          icon={<Network className="h-5 w-5" />}
          title="Knowledge Graph"
          description="Entities and relationships pulled out of your sources as they were indexed."
          accent="text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-500/10"
          actions={
            <>
              <Button
                variant="soft"
                size="sm"
                onClick={() => source.reload()}
                loading={source.loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportPng} disabled={isEmpty}>
                <Download className="h-3.5 w-3.5" />
                PNG
              </Button>
            </>
          }
        />
      </div>

      {/* controls */}
      <div className="shrink-0 space-y-2 px-4 pb-3 pt-2 sm:px-6">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[13rem] flex-1">
            <SearchInput
              value={q}
              onChange={setQ}
              onEnter={onSearchEnter}
              placeholder="Find an entity…"
              className="w-full"
            />
          </div>
          <Select
            label="Scope"
            value={scope}
            onChange={setScope}
            options={scopeOptions}
            className="min-w-[12rem]"
          />
          <Select
            label="Relation"
            value={relation}
            onChange={setRelation}
            options={relationOptions}
            className="min-w-[11rem]"
          />
          <Toggle
            checked={hideUnconnected}
            onChange={setHideUnconnected}
            label="Hide unconnected"
            hint="After filtering, drop entities left with no visible edge"
          />
        </div>

        {q.trim() && (
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
            {matches?.size
              ? `${matches.size} ${matches.size === 1 ? 'match' : 'matches'} — press Enter to jump to the closest.`
              : 'No entity matches that.'}
          </p>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <Info className="mt-px h-3 w-3 shrink-0" />
          This graph covers your whole account — the workspace switcher does not
          narrow it. Only entities that ended up in at least one relationship are
          returned.
          {graph.dangling > 0 && ` ${graph.dangling} edge(s) referenced a missing entity and were skipped.`}
        </p>
      </div>

      {/* canvas */}
      <div className="relative min-h-0 flex-1 px-4 pb-4 sm:px-6">
        <div
          ref={wrapRef}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedId(null)}
          className="relative h-full w-full overflow-hidden rounded-3xl border border-gray-100 bg-white dark:border-white/10 dark:bg-dark-primary"
        >
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Spinner className="h-6 w-6" />
              <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
                Loading entities and relationships…
              </p>
            </div>
          )}

          {source.error && !loading && (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md">
                <ErrorNote
                  message={source.error || 'Could not load the graph'}
                  onRetry={() => source.reload()}
                />
              </div>
            </div>
          )}

          {isEmpty && (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={<Network className="h-6 w-6" />}
                title={scope === 'all' ? 'No entities yet' : 'Nothing extracted for that chat'}
                description="The graph is built during ingestion: each source is passed to Mistral, which pulls out entities and the relationships between them. Index a page or a document — and make sure a Mistral key is set in Settings → Providers — and the entities will show up here."
                action={
                  <Button variant="gradient" size="sm" onClick={() => router.push('/capture')}>
                    Add a source
                  </Button>
                }
              />
            </div>
          )}

          {!loading && !source.error && graph.nodes.length > 0 && FG && size.w > 0 && (
            <FG
              ref={fgRef}
              graphData={view}
              width={size.w}
              height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={paintPointerArea}
              nodeLabel={(n: GNode) => `${n.label} — ${labelType(n.type)}`}
              linkCanvasObjectMode={() => 'after'}
              linkCanvasObject={paintLink}
              linkColor={(l: GLink) => (linkIncidentToSelection(l) ? ink.edgeActive : ink.edge)}
              linkWidth={(l: GLink) => (linkIncidentToSelection(l) ? 1.8 : 1)}
              cooldownTime={4000}
              d3AlphaDecay={0.025}
              d3VelocityDecay={0.32}
              onNodeClick={(n: GNode) => {
                setSelectedId((prev) => (prev === n.id ? null : n.id));
                focusNode(n);
              }}
              onBackgroundClick={() => setSelectedId(null)}
              onEngineStop={() => {
                // Fit once the first layout settles; afterwards the user owns the viewport.
                if (!selectedId) fgRef.current?.zoomToFit(400, 48);
              }}
            />
          )}

          {/* legend / filter — overlaid so the canvas keeps the full panel */}
          {!loading && graph.nodes.length > 0 && (
            <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
              <Panel
                padded={false}
                className="pointer-events-auto max-w-[min(34rem,calc(100%-5rem))] bg-white/85 p-2.5 backdrop-blur dark:bg-dark-primary/80"
              >
                <TypeLegend
                  entries={types.entries}
                  hidden={hidden}
                  onToggle={toggleType}
                  onSolo={soloType}
                  onShowAll={() => setHidden(new Set())}
                  dark={dark}
                  folded={types.folded}
                />
              </Panel>

              <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white/85 p-1 backdrop-blur dark:border-white/10 dark:bg-dark-primary/80">
                <IconButton
                  label="Zoom in"
                  icon={<ZoomIn className="h-4 w-4" />}
                  onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.4, 250)}
                />
                <IconButton
                  label="Zoom out"
                  icon={<ZoomOut className="h-4 w-4" />}
                  onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.4, 250)}
                />
                <IconButton
                  label="Fit to view"
                  icon={<Maximize className="h-4 w-4" />}
                  onClick={() => fgRef.current?.zoomToFit(400, 48)}
                />
              </div>
            </div>
          )}

          {/* node detail */}
          {selected && (
            <Panel
              padded={false}
              className="absolute bottom-3 right-3 z-10 flex max-h-[min(22rem,70%)] w-[min(20rem,calc(100%-1.5rem))] flex-col bg-white/90 backdrop-blur dark:bg-dark-primary/90"
            >
              <div className="flex items-start gap-2 border-b border-gray-100 p-3 dark:border-white/10">
                <GlyphSwatch slot={slotFor(selected.type)} dark={dark} size={14} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-gray-900 dark:text-white">
                    {selected.label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {labelType(selected.type)}
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    {selected.degree} {selected.degree === 1 ? 'connection' : 'connections'}
                  </p>
                </div>
                <IconButton
                  label="Close"
                  icon={<X className="h-3.5 w-3.5" />}
                  onClick={() => setSelectedId(null)}
                />
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {(graph.neighbours.get(selected.id) ?? []).length === 0 ? (
                  <p className="px-1 py-2 text-[11.5px] text-gray-400 dark:text-gray-500">
                    No relationships recorded.
                  </p>
                ) : (
                  (graph.neighbours.get(selected.id) ?? []).map((nb, i) => (
                    <button
                      key={`${nb.id}-${nb.relation}-${i}`}
                      type="button"
                      onClick={() => {
                        setSelectedId(nb.id);
                        focusNode(view.nodes.find((n) => n.id === nb.id));
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <Crosshair className="h-3 w-3 shrink-0 text-gray-300 dark:text-gray-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-gray-700 dark:text-gray-200">
                          {nb.label}
                        </span>
                        {nb.relation && (
                          <span className="block truncate text-[10.5px] text-gray-400 dark:text-gray-500">
                            {nb.relation}
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 p-2 dark:border-white/10">
                <Button
                  variant="soft"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    router.push(
                      `/text-generator?ask=${encodeURIComponent(
                        `What do my sources say about ${selected.label}?`,
                      )}`,
                    )
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask about this entity
                </Button>
              </div>
            </Panel>
          )}

          {/* counts */}
          {!loading && graph.nodes.length > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-3 flex gap-1.5">
              <Pill tone="neutral">
                {compactNumber(view.nodes.length)}
                {view.nodes.length !== graph.nodes.length && ` / ${compactNumber(graph.nodes.length)}`}{' '}
                entities
              </Pill>
              <Pill tone="neutral">
                {compactNumber(view.links.length)}
                {view.links.length !== graph.links.length && ` / ${compactNumber(graph.links.length)}`}{' '}
                links
              </Pill>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
