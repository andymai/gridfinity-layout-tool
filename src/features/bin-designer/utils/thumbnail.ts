/**
 * Thumbnail capture utility for the Bin Designer.
 *
 * Captures the current state of the Three.js preview canvas and
 * resizes it to a small data URL for storage in IndexedDB.
 */

const THUMBNAIL_SIZE = 96;

/** Module-level ref to the preview canvas element, set by PreviewCanvas */
let previewCanvasEl: HTMLCanvasElement | null = null;

/**
 * Register the provided canvas as the module-level preview canvas used for thumbnail generation.
 *
 * @param canvas - The HTMLCanvasElement to use as the preview source when capturing thumbnails
 */
export function setPreviewCanvas(canvas: HTMLCanvasElement): void {
  previewCanvasEl = canvas;
}

/**
 * Clear the stored preview canvas reference.
 *
 * After calling this, no preview canvas is registered and thumbnail capture will treat the preview as unavailable.
 */
export function clearPreviewCanvas(): void {
  previewCanvasEl = null;
}

/** Thumbnail size for 3MF package (larger than IndexedDB thumbnails for better quality) */
const THREEMF_THUMBNAIL_SIZE = 256;

/**
 * Capture a thumbnail from the 3D preview as PNG Uint8Array.
 * Used for embedding in 3MF packages.
 * Returns null if canvas isn't available.
 */
export function captureThumbnailPNG(): Promise<Uint8Array | null> {
  if (!previewCanvasEl) return Promise.resolve(null);

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = THREEMF_THUMBNAIL_SIZE;
    offscreen.height = THREEMF_THUMBNAIL_SIZE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    const src = previewCanvasEl;
    const srcSize = Math.min(src.width, src.height);
    const srcX = (src.width - srcSize) / 2;
    const srcY = (src.height - srcSize) / 2;

    ctx.drawImage(
      src,
      srcX, srcY, srcSize, srcSize,
      0, 0, THREEMF_THUMBNAIL_SIZE, THREEMF_THUMBNAIL_SIZE
    );

    return new Promise((resolve) => {
      offscreen.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          blob.arrayBuffer().then(
            (buf) => resolve(new Uint8Array(buf)),
            () => resolve(null)
          );
        },
        'image/png'
      );
    });
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * Capture a centered square thumbnail of the current 3D preview canvas.
 *
 * Produces a JPEG image scaled to THUMBNAIL_SIZE × THUMBNAIL_SIZE by center-cropping the preview canvas and exporting it at quality 0.7.
 *
 * @returns A JPEG data URL for the generated thumbnail, or `null` if the preview canvas or 2D context is unavailable or if an error occurs (e.g., canvas is tainted).
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