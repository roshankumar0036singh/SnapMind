/**
 * Entity-type palette for the knowledge graph.
 *
 * Three findings drive the shape of this file.
 *
 * 1. **Entity types are free-form.** `graph_logic.py:31` asks the extractor for
 *    `{"name", "type"}` with no enum and `:79` defaults to `"concept"`, so the
 *    type set is open, unbounded, and inconsistently cased. Hues therefore get
 *    assigned in a fixed order over the *sorted normalised* type names, and
 *    anything past the last slot folds into "Other" rather than generating a
 *    colour. Sorting by name (not by frequency) is what keeps a colour bound to
 *    the entity: hiding a type must never repaint the ones still on screen.
 *
 * 2. **A force graph is an all-pairs encoding.** Every type can end up adjacent
 *    to every other, so the adjacent-pair validation that licenses eight
 *    categorical hues does not apply here — only the leading slots clear the
 *    all-pairs floors. The documented mitigation for the rest is a secondary
 *    channel, so each slot also carries a distinct glyph shape. Colour and shape
 *    are redundant: neither has to be read alone.
 *
 * 3. **These hexes are a documented, validated set and are reproduced
 *    unchanged.** The brand indigo is deliberately *not* one of them — it stays
 *    reserved for UI chrome, so a selection ring can never be mistaken for an
 *    entity type. Selection is encoded by geometry (halo + radius) for the same
 *    reason.
 *
 * Edge and ink colours are taken from the alpha-expressed rows of that
 * palette rather than its opaque ones, because those composite correctly onto
 * this app's surfaces (`#FFFFFF` light, `#171F2E` dark) instead of the
 * near-neutral surfaces the opaque steps were picked against.
 *
 * Canvas needs raw hex — it cannot read CSS custom properties — so this is the
 * one place in the dashboard that carries literal colour values.
 */

export type GlyphShape =
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'pentagon'
  | 'cross'
  | 'ring';

export type Slot = {
  /** Hue name, for the debug/legend title attribute. */
  hue: string;
  light: string;
  dark: string;
  shape: GlyphShape;
};

/**
 * Fixed slot order. The ordering is the colour-blind-safety mechanism, not
 * decoration — do not re-order to "look nicer", and do not extend past eight.
 */
export const SLOTS: Slot[] = [
  { hue: 'blue', light: '#2a78d6', dark: '#3987e5', shape: 'circle' },
  { hue: 'orange', light: '#eb6834', dark: '#d95926', shape: 'square' },
  { hue: 'aqua', light: '#1baf7a', dark: '#199e70', shape: 'diamond' },
  { hue: 'yellow', light: '#eda100', dark: '#c98500', shape: 'triangle' },
  { hue: 'magenta', light: '#e87ba4', dark: '#d55181', shape: 'hexagon' },
  { hue: 'green', light: '#008300', dark: '#008300', shape: 'pentagon' },
  { hue: 'violet', light: '#4a3aa7', dark: '#9085e9', shape: 'cross' },
  { hue: 'red', light: '#e34948', dark: '#e66767', shape: 'ring' },
];

/** Everything past the eighth type. Muted in both modes, by design. */
export const OTHER_SLOT: Slot = {
  hue: 'other',
  light: '#898781',
  dark: '#898781',
  shape: 'circle',
};

export const OTHER_TYPE = 'other';

/** Chrome that has to be drawn onto the canvas rather than styled in CSS. */
export const CANVAS_INK = {
  light: {
    label: '#0b0b0b',
    labelSecondary: '#52514e',
    edge: 'rgba(11,11,11,0.14)',
    edgeActive: 'rgba(11,11,11,0.42)',
    halo: '#ffffff',
    surface: '#ffffff',
  },
  dark: {
    label: '#ffffff',
    labelSecondary: '#c3c2b7',
    edge: 'rgba(255,255,255,0.16)',
    edgeActive: 'rgba(255,255,255,0.48)',
    halo: '#171f2e',
    surface: '#171f2e',
  },
} as const;

/** Lower-case, collapse whitespace, drop the punctuation extractors sprinkle in. */
export function normaliseType(raw?: string | null): string {
  const t = (raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  return t || 'concept';
}

/** `person` → `Person`, `open question` → `Open question`. */
export function labelType(type: string): string {
  if (type === OTHER_TYPE) return 'Other';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export type TypeAssignment = {
  /** Every distinct normalised type present, sorted, with its slot. */
  entries: { type: string; slot: Slot; count: number }[];
  /** Normalised type → slot. Types past the eighth all map to `OTHER_SLOT`. */
  slotOf: (type: string) => Slot;
  /** True when at least one type folded into "Other". */
  folded: boolean;
};

/**
 * Bind types to slots.
 *
 * `counts` decides which types exist and how the legend is ordered *by count*,
 * but the slot each type gets comes from its position in the **name-sorted**
 * list — so the mapping is stable across reloads and unaffected by filtering.
 */
export function assignTypes(counts: Map<string, number>): TypeAssignment {
  const byName = [...counts.keys()].sort((a, b) => a.localeCompare(b));

  const map = new Map<string, Slot>();
  byName.forEach((type, i) => {
    map.set(type, i < SLOTS.length ? SLOTS[i] : OTHER_SLOT);
  });

  const entries = byName
    .map((type) => ({ type, slot: map.get(type)!, count: counts.get(type) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  return {
    entries,
    slotOf: (type: string) => map.get(type) ?? OTHER_SLOT,
    folded: byName.length > SLOTS.length,
  };
}

/**
 * Draw one glyph centred on `(x, y)` with radius `r`.
 *
 * The shape is the palette's secondary channel, so it is drawn at every zoom —
 * dropping it on small nodes would quietly reduce the encoding back to colour
 * alone, which is the thing it exists to prevent.
 */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  shape: GlyphShape,
  x: number,
  y: number,
  r: number,
) {
  const polygon = (sides: number, rotation: number) => {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rotation + (i * 2 * Math.PI) / sides;
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
      break;

    case 'ring':
      // Hollow: fill the disc, then punch the middle back to the surface.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
      break;

    case 'square':
      // A 4-gon rotated 45° reads as a square; unrotated it reads as a diamond.
      polygon(4, Math.PI / 4);
      break;

    case 'diamond':
      polygon(4, 0);
      break;

    case 'triangle':
      polygon(3, -Math.PI / 2);
      break;

    case 'pentagon':
      polygon(5, -Math.PI / 2);
      break;

    case 'hexagon':
      polygon(6, 0);
      break;

    case 'cross': {
      const arm = r * 0.42;
      ctx.beginPath();
      ctx.rect(x - r, y - arm, r * 2, arm * 2);
      ctx.rect(x - arm, y - r, arm * 2, r * 2);
      ctx.fill();
      break;
    }
  }
}

/** SVG path for the same glyph, so the legend swatch matches the canvas mark. */
export function glyphPath(shape: GlyphShape, size = 12): string {
  const c = size / 2;
  const r = size / 2 - 0.5;
  const poly = (sides: number, rotation: number) =>
    Array.from({ length: sides }, (_, i) => {
      const a = rotation + (i * 2 * Math.PI) / sides;
      return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
    }).join(' L');

  switch (shape) {
    case 'circle':
    case 'ring':
      return `M ${c},${c - r} a ${r},${r} 0 1,0 0,${r * 2} a ${r},${r} 0 1,0 0,${-r * 2} Z`;
    case 'square':
      return `M ${poly(4, Math.PI / 4)} Z`;
    case 'diamond':
      return `M ${poly(4, 0)} Z`;
    case 'triangle':
      return `M ${poly(3, -Math.PI / 2)} Z`;
    case 'pentagon':
      return `M ${poly(5, -Math.PI / 2)} Z`;
    case 'hexagon':
      return `M ${poly(6, 0)} Z`;
    case 'cross': {
      const a = r * 0.42;
      return `M ${c - r},${c - a} H ${c - a} V ${c - r} H ${c + a} V ${c - a} H ${c + r} V ${c + a} H ${c + a} V ${c + r} H ${c - a} V ${c + a} H ${c - r} Z`;
    }
  }
}
