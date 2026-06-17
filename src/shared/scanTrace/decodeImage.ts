/**
 * Browser glue: decode an image Blob into a downscaled canvas (the ML
 * segmenter's image source) and read its RGBA pixels for the pure tracer.
 *
 * Downscales large phone photos first — a 12 MP capture is far more resolution
 * than silhouette tracing needs, and downscaling keeps both segmentation and
 * the pure pipeline fast on a phone. Browser-only (canvas + createImageBitmap),
 * so it is not unit-tested in node; the pure tracer is.
 */

import type { ImageDataLike } from './types';

const DEFAULT_MAX_DIM = 1280;

/**
 * Decode a Blob into a downscaled canvas. The canvas doubles as the ML
 * segmenter's image source and the backing for `imageDataFromCanvas`, so the
 * photo is decoded and scaled exactly once per capture.
 */
export async function decodeImageToCanvas(
  blob: Blob,
  maxDim: number = DEFAULT_MAX_DIM
): Promise<HTMLCanvasElement> {
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
    return canvas;
  } finally {
    bitmap.close();
  }
}

/** Read RGBA pixels out of a canvas for the pure tracer/card pipeline. */
export function imageDataFromCanvas(canvas: HTMLCanvasElement): ImageDataLike {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: imageData.data };
}
