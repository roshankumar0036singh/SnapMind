'use client';

import { Segmented } from '@/components/dashboard/ui';
import { dayKey } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

/**
 * Sources-added-per-day, last N days.
 *
 * Form: single-series magnitude over time -> bar chart.
 * Color: ONE hue for every bar (brand indigo). Deliberately not a value ramp —
 * that would double-encode bar length as lightness and burn the free channel.
 * Chrome: solid hairline gridlines, recessive axis, selective direct label (the
 * peak only), 2px surface gap between bars, 4px rounded ends on the baseline.
 * A table view twin makes every value reachable without hovering.
 */

type Props = {
  /** Timestamps of indexed items. Any parseable date form. */
  timestamps: (string | number | Date)[];
  days?: number;
  className?: string;
};

type Bucket = { key: string; label: string; long: string; count: number };

function buildBuckets(timestamps: (string | number | Date)[], days: number): Bucket[] {
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    const k = dayKey(t);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const out: Bucket[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({
      key: k,
      label: d.toLocaleDateString(undefined, { day: 'numeric' }),
      long: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      count: counts.get(k) ?? 0,
    });
  }
  return out;
}

export default function ActivityChart({ timestamps, days = 14, className }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);

  const buckets = useMemo(() => buildBuckets(timestamps, days), [timestamps, days]);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const peakIndex = buckets.findIndex((b) => b.count === max && max > 0);

  // Four gridlines including the baseline, at nice round values.
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 3));
    return [0, step, step * 2, step * 3];
  }, [max]);
  const scaleMax = ticks[ticks.length - 1];

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Sources added
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {total} in the last {days} days
          </p>
        </div>
        <Segmented
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
          value={view}
          onChange={(v) => setView(v as 'chart' | 'table')}
        />
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto custom-scrollbar -mx-1 px-1">
          <table className="w-full text-sm">
            <caption className="sr-only">Sources added per day over the last {days} days</caption>
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th scope="col" className="py-2 font-medium">
                  Day
                </th>
                <th scope="col" className="py-2 font-medium text-right">
                  Sources
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {buckets.map((b) => (
                <tr key={b.key}>
                  <td className="py-2 text-gray-700 dark:text-gray-300">{b.long}</td>
                  <td className="py-2 text-right tabular-nums text-gray-900 dark:text-white">
                    {b.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Height covers plot + x-axis band so the card never gets a nested scroll.
        <div className="relative">
          <div className="relative h-44">
            {/* Gridlines: solid hairlines, one shade off the surface. */}
            <div className="absolute inset-0 flex flex-col-reverse justify-between pointer-events-none">
              {ticks.map((t) => (
                <div key={t} className="relative">
                  <div className="border-t border-gray-100 dark:border-white/[0.07]" />
                  <span className="absolute -top-2 -left-1 -translate-x-full text-[10px] tabular-nums text-gray-400 dark:text-gray-600 pr-1">
                    {t}
                  </span>
                </div>
              ))}
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {buckets.map((b, i) => {
                const pct = scaleMax ? (b.count / scaleMax) * 100 : 0;
                const isPeak = i === peakIndex;
                return (
                  <div
                    key={b.key}
                    className="relative flex-1 h-full flex items-end"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {/* Hit area spans the full column height, not just the bar. */}
                    <button
                      type="button"
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      aria-label={`${b.long}: ${b.count} source${b.count === 1 ? '' : 's'}`}
                      className="absolute inset-0 w-full focus-visible:outline-none focus-visible:shadow-ring rounded-md"
                    />
                    <div
                      style={{ height: `${Math.max(b.count > 0 ? 3 : 0, pct)}%` }}
                      className={cn(
                        'w-full rounded-t-[4px] transition-colors pointer-events-none',
                        b.count === 0
                          ? 'bg-gray-100 dark:bg-white/[0.06] h-[2px]'
                          : hover === i
                            ? 'bg-primary-700 dark:bg-primary-300'
                            : 'bg-primary-600 dark:bg-primary-400',
                      )}
                    />
                    {/* Direct-label the peak only. */}
                    {isPeak && max > 0 && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300 pointer-events-none"
                        style={{ bottom: `calc(${pct}% + 4px)` }}
                      >
                        {b.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tooltip */}
            {hover !== null && (
              <div
                className="absolute -top-1 z-10 pointer-events-none"
                style={{
                  left: `${((hover + 0.5) / buckets.length) * 100}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-medium whitespace-nowrap shadow-theme-lg">
                  {buckets[hover].long} · {buckets[hover].count}
                </div>
              </div>
            )}
          </div>

          {/* X axis — every other tick so labels never collide. */}
          <div className="flex gap-[2px] mt-2 border-t border-gray-100 dark:border-white/[0.07] pt-1.5">
            {buckets.map((b, i) => (
              <span
                key={b.key}
                className="flex-1 text-center text-[10px] tabular-nums text-gray-400 dark:text-gray-600"
              >
                {i % 2 === 0 ? b.label : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
