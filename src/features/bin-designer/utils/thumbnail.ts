/**
 * Thumbnail capture utility for the Bin Designer.
 *
 * Captures the current state of the Three.js preview canvas and
 * resizes it to a small data URL for storage in IndexedDB.
 */

const THUMBNAIL_SIZE = 96;

/** Module-level ref to the preview canvas element, set by PreviewCanvas */
let previewCanvasEl: HTMLCanvasElement | null = null;

/** Register the preview canvas element (called from PreviewCanvas onCreated) */
export function setPreviewCanvas(canvas: HTMLCanvasElement): void {
  previewCanvasEl = canvas;
}

/** Clear the preview canvas ref (called on unmount) */
export function clearPreviewCanvas(): void {
  previewCanvasEl = null;
}

/**
 * Capture a thumbnail from the current 3D preview.
 * Returns a small JPEG data URL, or null if the canvas isn't available.
 */
export function captureThumbnail(): string | null {
  if (!previewCanvasEl) return null;

  try {
    // Create an offscreen canvas at thumbnail size
    const offscreen = document.createElement('canvas');
    offscreen.width = THUMBNAIL_SIZE;
    offscreen.height = THUMBNAIL_SIZE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Draw the preview canvas scaled down to thumbnail size (center-crop to square)
    const src = previewCanvasEl;
    const srcSize = Math.min(src.width, src.height);
    const srcX = (src.width - srcSize) / 2;
    const srcY = (src.height - srcSize) / 2;

    ctx.drawImage(
      src,
      srcX, srcY, srcSize, srcSize,
      0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE
    );

    // Export as JPEG for smaller file size
    return offscreen.toDataURL('image/jpeg', 0.7);
  } catch {
    // Canvas may be tainted or unavailable
    return null;
  }
}
