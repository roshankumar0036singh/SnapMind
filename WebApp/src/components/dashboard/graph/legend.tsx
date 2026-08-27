'use client';

/**
 * Legend for the knowledge graph — and the type filter, which is the same
 * control. A legend that is only a key makes you look somewhere else to act on
 * it; here the row you read is the row you click.
 *
 * Each swatch draws the slot's glyph, not a colour chip, so the legend is a
 * literal sample of the mark on the canvas. That is what makes the shape channel
 * usable: you can match a triangle on screen to a triangle in the list without
 * relying on the hue at all.
 */

import { Pill } from '@/components/dashboard/ui';
import { glyphPath, labelType, type Slot } from '@/lib/graph-palette';
import { compactNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export function GlyphSwatch({
  slot,
  dark,
  size = 12,
  className,
}: {
  slot: Slot;
  dark: boolean;
  size?: number;
  className?: string;
}) {
  const fill = dark ? slot.dark : slot.light;
  // The ring glyph is hollow, so the punch has to be the surface colour rather
  // than transparent — an SVG hole would show whatever is behind the swatch.
  const punch = dark ? '#171f2e' : '#ffffff';
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path d={glyphPath(slot.shape, size)} fill={fill} />
      {slot.shape === 'ring' && (
        <circle cx={size / 2} cy={size / 2} r={size * 0.22} fill={punch} />
      )}
    </svg>
  );
}

export default function TypeLegend({
  entries,
  hidden,
  onToggle,
  onSolo,
  onShowAll,
  dark,
  folded,
}: {
  entries: { type: string; slot: Slot; count: number }[];
  /** Types currently filtered out. */
  hidden: Set<string>;
  onToggle: (type: string) => void;
  /** Show only this type — the shortcut people actually want from a legend. */
  onSolo: (type: string) => void;
  onShowAll: () => void;
  dark: boolean;
  folded: boolean;
}) {
  if (!entries.length) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {entries.map(({ type, slot, count }) => {
          const off = hidden.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggle(type)}
              onDoubleClick={() => onSolo(type)}
              title={`${labelType(type)} — ${count} ${count === 1 ? 'entity' : 'entities'}. Click to ${
                off ? 'show' : 'hide'
              }, double-click to isolate.`}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition',
                off
                  ? 'border-gray-100 text-gray-400 opacity-60 dark:border-white/10 dark:text-gray-500'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/5',
              )}
            >
              <GlyphSwatch slot={slot} dark={dark} className={off ? 'opacity-40' : undefined} />
              <span className="truncate max-w-[9rem]">{labelType(type)}</span>
              <span className="tabular-nums text-gray-400 dark:text-gray-500">
                {compactNumber(count)}
              </span>
            </button>
          );
        })}
      </div>

      {folded && (
        <p className="text-[10.5px] text-gray-400 dark:text-gray-500">
          Past eight types share the muted “Other” mark — colour stops being
          reliable beyond that, so they are grouped rather than given new hues.
        </p>
      )}

      {hidden.size > 0 && (
        <Pill tone="brand" onClick={onShowAll}>
          Show all types
        </Pill>
      )}
    </div>
  );
}
