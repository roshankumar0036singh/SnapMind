'use client';

/**
 * Detail view for one indexed source.
 *
 * Chunks come from GET sites/chunks/{url} rather than GET export/{url}: the
 * export route returns the same rows *plus* a 3072-dimension embedding
 * serialised as text, which is megabytes for even a modest page. Export stays
 * the download path; this is the read path.
 */

import {
  Button,
  Drawer,
  ErrorNote,
  IconBadge,
  INSET,
  Pill,
  Skeleton,
  Spinner,
} from '@/components/dashboard/ui';
import { useCapture } from '@/context/CaptureContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api-client';
import {
  SOURCE_ACCENT,
  SOURCE_LABELS,
  absoluteTime,
  compactNumber,
  hostname,
  prettyUrl,
  relativeTime,
  sourceKind,
  truncate,
  downloadBlob,
} from '@/lib/format';
import type { Site, SiteChunk } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Languages,
  MessageSquare,
  RefreshCw,
  Tag,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

type ChunkResponse = { success?: boolean; url?: string; total?: number; chunks?: SiteChunk[] };

export function SourceDrawer({
  site,
  open,
  onClose,
  onDelete,
}: {
  site: Site | null;
  open: boolean;
  onClose: () => void;
  onDelete: (site: Site) => void;
}) {
  const { ingestUrl } = useCapture();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<'json' | 'text' | 'reingest' | null>(null);

  const url = site?.url;
  const chunks = useApi<ChunkResponse>(
    (signal) => api.get(`sites/chunks/${encodeURIComponent(url!)}`, { signal }),
    open && url ? [url] : null,
  );

  const kind = sourceKind(url);
  const rows = chunks.data?.chunks ?? [];
  const total = chunks.data?.total ?? site?.chunk_count ?? 0;

  async function download(format: 'json' | 'text') {
    if (!url) return;
    setBusy(format);
    try {
      const blob = await api.blob(`export/${encodeURIComponent(url)}`, undefined, {
        query: { format },
      });
      const stem = (hostname(url) || 'source').replace(/[^a-z0-9.-]/gi, '_');
      downloadBlob(blob, `snapmind_${stem}.${format === 'json' ? 'json' : 'txt'}`);
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function reingest() {
    if (!url) return;
    setBusy('reingest');
    try {
      await ingestUrl({ url });
      chunks.reload();
    } finally {
      setBusy(null);
    }
  }

  const isFetchable = /^https?:\/\//i.test(url ?? '');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={site ? site.title && site.title !== site.url ? site.title : prettyUrl(site.url, 48) : ''}
      subtitle={site ? hostname(site.url) || SOURCE_LABELS[kind] : undefined}
      width="max-w-2xl"
      footer={
        site && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={busy === 'json'}
                onClick={() => download('json')}
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={busy === 'text'}
                onClick={() => download('text')}
              >
                <Download className="w-3.5 h-3.5" />
                Text
              </Button>
              {isFetchable && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === 'reingest'}
                  onClick={reingest}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-index
                </Button>
              )}
            </div>
            <Button variant="danger" size="sm" onClick={() => onDelete(site)}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        )
      }
    >
      {!site ? null : (
        <div className="space-y-6">
          {/* Identity */}
          <div className="flex items-start gap-3.5">
            <IconBadge
              size="lg"
              icon={<Globe className="w-5 h-5" />}
              className={cn(SOURCE_ACCENT[kind])}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="brand">{SOURCE_LABELS[kind]}</Pill>
                {site.translated && (
                  <Pill tone="success">
                    <Languages className="w-3 h-3" />
                    Translated
                  </Pill>
                )}
                {site.original_lang && <Pill>{site.original_lang.toUpperCase()}</Pill>}
              </div>
              {isFetchable ? (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-start gap-1.5 text-xs text-primary-600 dark:text-primary-300 hover:underline break-all"
                >
                  {site.url}
                  <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                </a>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-all">{site.url}</p>
              )}
            </div>
          </div>

          {/* Facts */}
          <dl className={cn(INSET, 'grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-4 p-4')}>
            <Fact label="Chunks" value={compactNumber(total)} />
            <Fact label="Indexed" value={relativeTime(site.last_updated_at)} />
            <Fact
              label="Exact time"
              value={absoluteTime(site.last_updated_at) || '—'}
              className="col-span-2 sm:col-span-1"
            />
          </dl>

          {/* Tags */}
          {site.tags && site.tags.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2.5">
                Semantic tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {site.tags.map((t) => (
                  <Link key={t} href={`/library?tag=${encodeURIComponent(t)}`} onClick={onClose}>
                    <Pill tone="brand">
                      <Tag className="w-3 h-3" />
                      {t}
                    </Pill>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Ask about it */}
          <Link
            href={`/text-generator?source=${encodeURIComponent(site.url)}`}
            className={cn(
              INSET,
              'flex items-center gap-3 p-4 hover:border-primary-200 dark:hover:border-primary-500/30 transition',
            )}
          >
            <IconBadge
              size="sm"
              icon={<MessageSquare className="w-4 h-4" />}
              className="text-violet-600 bg-violet-50 dark:bg-violet-500/10"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-white/90">
                Ask about this source
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                Opens chat scoped to this document
              </span>
            </span>
            <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
          </Link>

          {/* Chunks */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Indexed chunks
              </h3>
              {chunks.loading ? (
                <Spinner />
              ) : (
                rows.length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    showing {rows.length} of {total}
                  </span>
                )
              )}
            </div>

            {chunks.error ? (
              <ErrorNote message={chunks.error} onRetry={chunks.reload} />
            ) : chunks.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No chunks stored for this source.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((c, i) => {
                  const isOpen = expanded === c.id;
                  const page = (c.metadata as { page?: number } | null)?.page;
                  return (
                    <li key={c.id} className={cn(INSET, 'overflow-hidden')}>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : c.id)}
                        aria-expanded={isOpen}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 focus-visible:outline-none focus-visible:shadow-ring"
                      >
                        <span className="mt-0.5 w-6 h-6 shrink-0 rounded-lg bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                          {i + 1}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className={cn(
                              'block text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words',
                              !isOpen && 'line-clamp-2',
                            )}
                          >
                            {isOpen ? c.content : truncate(c.content, 220)}
                          </span>
                          {(page || c.created_at) && (
                            <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                              {page ? (
                                <span className="inline-flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  page {page}
                                </span>
                              ) : null}
                              {c.created_at ? <span>{relativeTime(c.created_at)}</span> : null}
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 shrink-0 text-gray-400 transition-transform mt-0.5',
                            isOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 pl-[3.25rem] flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(c.content);
                              toast.success('Chunk copied');
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 transition"
                          >
                            <Copy className="w-3 h-3" />
                            Copy text
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

function Fact({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white/90 truncate">
        {value}
      </dd>
    </div>
  );
}
