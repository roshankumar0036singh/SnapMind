/** Small client-side image helpers shared by the vision screen. */

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];

export function isImageFile(file: File | null | undefined): boolean {
  return Boolean(file && file.type.startsWith('image/'));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale to `max` on the long edge and re-encode as JPEG.
 *
 * Used for history entries: a handful of full-resolution screenshots would blow
 * the ~5 MB localStorage quota on its own, and a thumbnail is all the history
 * list actually shows.
 */
export async function thumbnail(dataUrl: string, max = 160, quality = 0.7): Promise<string> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return '';
  }
}

/** Natural dimensions, or null if the data URL will not decode. */
export async function imageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}
