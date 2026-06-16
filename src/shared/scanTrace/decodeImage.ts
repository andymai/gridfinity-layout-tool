/**
 * Browser glue: decode an image Blob into an ImageDataLike for the tracer.
 *
 * Downscales large phone photos before reading pixels — a 12 MP capture is far
 * more resolution than silhouette tracing needs, and downscaling keeps the
 * pure pipeline fast on a phone. Browser-only (canvas + createImageBitmap), so
 * it is not unit-tested in node; the pure tracer is.
 */

import type { ImageDataLike } from './types';

const DEFAULT_MAX_DIM = 1280;

export async function decodeImageToImageData(
  blob: Blob,
  maxDim: number = DEFAULT_MAX_DIM
): Promise<ImageDataLike> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    return { width, height, data: imageData.data };
  } finally {
    bitmap.close();
  }
}
