'use client';

/**
 * The image stage: shows one shot, lets you drag a region out of it.
 *
 * The `<img>` is sized by `max-h`/`max-w` with `w-auto h-auto` rather than
 * `object-contain` inside a fixed box, so the element's bounding rect *is* the
 * painted image. That makes mapping a selection back to natural pixels a single
 * ratio, with no letterbox arithmetic to get wrong.
 */

import { IconButton } from '@/components/dashboard/ui';
import { cn } from '@/lib/utils';
import { Crop, Maximize2, X } from 'lucide-react';
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type Rect = { x: number; y: number; w: number; h: number };

/** Cut `rect` (in displayed px) out of `src` and return a PNG data URL. */
async function cropToDataUrl(src: string, rect: Rect, displayW: number, displayH: number) {
  const img = new Image();
  img.src = src;
  await img.decode();

  const sx = img.naturalWidth / displayW;
  const sy = img.naturalHeight / displayH;

  const w = Math.max(1, Math.round(rect.w * sx));
  const h = Math.max(1, Math.round(rect.h * sy));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(img, Math.round(rect.x * sx), Math.round(rect.y * sy), w, h, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

export default function CropStage({
  src,
  alt,
  onCrop,
  onClear,
}: {
  src: string;
  alt: string;
  /** Called with a new data URL when the user commits a crop. */
  onCrop: (dataUrl: string) => void;
  onClear?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);

  const local = (e: ReactPointerEvent) => {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const p = local(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    const p = local(e);
    if (!p) return;
    setRect({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onPointerUp = () => {
    startRef.current = null;
    // A click, not a drag — treat it as "clear the selection".
    setRect((r) => (r && r.w > 8 && r.h > 8 ? r : null));
  };

  const commit = useCallback(async () => {
    const box = imgRef.current?.getBoundingClientRect();
    if (!rect || !box) return;
    setBusy(true);
    try {
      onCrop(await cropToDataUrl(src, rect, box.width, box.height));
      setRect(null);
    } finally {
      setBusy(false);
    }
  }, [rect, src, onCrop]);

  const hasSelection = Boolean(rect && rect.w > 8 && rect.h > 8);

  return (
    <div className="relative flex flex-col items-center">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => e.key === 'Escape' && setRect(null)}
        className="relative inline-block cursor-crosshair touch-none select-none overflow-hidden rounded-2xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="block h-auto max-h-[26rem] w-auto max-w-full"
        />

        {hasSelection && rect && (
          <>
            {/* Dim everything outside the selection with four panes — cheaper
                and crisper than an SVG mask, and it scales with the image. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gray-900/45" style={{ height: rect.y }} />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-gray-900/45"
              style={{ top: rect.y + rect.h }}
            />
            <div
              className="pointer-events-none absolute left-0 bg-gray-900/45"
              style={{ top: rect.y, height: rect.h, width: rect.x }}
            />
            <div
              className="pointer-events-none absolute right-0 bg-gray-900/45"
              style={{ top: rect.y, height: rect.h, left: rect.x + rect.w }}
            />
            <div
              className="pointer-events-none absolute rounded-md ring-2 ring-inset ring-amber-400"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          </>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {hasSelection ? (
          <>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={busy}
              className={cn(
                'flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-amber-600',
                busy && 'opacity-60',
              )}
            >
              <Crop className="h-3 w-3" />
              {busy ? 'Cropping…' : `Crop ${Math.round(rect!.w)}×${Math.round(rect!.h)}`}
            </button>
            <IconButton label="Clear selection" icon={<X className="h-3.5 w-3.5" />} onClick={() => setRect(null)} />
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <Maximize2 className="h-3 w-3" />
            Drag on the image to analyse just one region
          </p>
        )}

        {onClear && !hasSelection && (
          <IconButton label="Remove this image" icon={<X className="h-3.5 w-3.5" />} onClick={onClear} />
        )}
      </div>
    </div>
  );
}
