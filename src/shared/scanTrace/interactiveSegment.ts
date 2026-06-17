/**
 * Tap-prompted ML segmentation (browser-only, like decodeImage.ts).
 *
 * Wraps MediaPipe's Interactive Segmenter ("Magic Touch"): given a photo and a
 * point the user tapped on the tool, it returns a soft probability mask of just
 * that object. This replaces the global Otsu threshold's guesswork — the model is
 * *told* which object to trace, which kills the "traced the background / card /
 * a sub-region" failures.
 *
 * The module lazy-imports `@mediapipe/tasks-vision` so the ~big WASM runtime and
 * the model never enter the eager scan bundle; the assets are self-hosted under
 * `/models/` (see scripts/vite-plugin-mediapipe-assets.ts). The photo itself
 * never leaves the device — inference is fully local.
 */

import type { InteractiveSegmenter } from '@mediapipe/tasks-vision';
import type { Point } from './types';
import type { SoftMask } from './softContour';

const WASM_BASE_PATH = '/models/tasks-vision';
const MODEL_PATH = '/models/interactive-segmenter/magic_touch.tflite';

let segmenterPromise: Promise<InteractiveSegmenter> | null = null;

async function getSegmenter(): Promise<InteractiveSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, InteractiveSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
      const create = (delegate: 'GPU' | 'CPU') =>
        InteractiveSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          // The confidence mask is a soft [0,1] field — its sub-pixel edge
          // location is what a marching-squares trace needs. Keep the category
          // mask as a fallback for runtimes that don't return confidence.
          outputCategoryMask: true,
          outputConfidenceMasks: true,
        });
      // Prefer the GPU (WebGL) delegate; fall back to CPU before giving up so a
      // device with flaky WebGL still gets ML segmentation (~130ms) rather than
      // dropping all the way to the classical tracer.
      try {
        return await create('GPU');
      } catch {
        return await create('CPU');
      }
    })().catch((error: unknown) => {
      // Let the next call retry a transient failure (e.g. asset fetch hiccup)
      // instead of caching a rejected promise forever.
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

/** Eagerly warm the model so the first segmentation isn't gated on the download. */
export function preloadSegmenter(): void {
  void getSegmenter().catch(() => {
    /* surfaced when segmentAt is actually called */
  });
}

/**
 * Segment the object at `seed` (normalized 0–1) in `source`, returning a soft
 * foreground probability mask at the source's resolution. Prefers MediaPipe's
 * confidence mask (the channel most confident at the tapped pixel, so we don't
 * depend on index ordering); falls back to the binary category mask as a 0/1
 * field if confidence masks aren't available.
 */
export async function segmentAt(source: HTMLCanvasElement, seed: Point): Promise<SoftMask> {
  const segmenter = await getSegmenter();
  const result = segmenter.segment(source, {
    keypoint: { x: clamp01(seed.x), y: clamp01(seed.y) },
  });
  try {
    const confidence = result.confidenceMasks;
    if (confidence && confidence.length > 0) {
      const width = confidence[0].width;
      const height = confidence[0].height;
      const sx = clampIndex(seed.x, width);
      const sy = clampIndex(seed.y, height);
      let best: Float32Array | null = null;
      let bestVal = -1;
      for (const mask of confidence) {
        const arr = mask.getAsFloat32Array();
        const here = arr[sy * width + sx];
        if (here > bestVal) {
          bestVal = here;
          best = Float32Array.from(arr); // copy: the buffer may be reused/freed
        }
      }
      if (best) return { width, height, data: best };
    }

    const categoryMask = result.categoryMask;
    if (!categoryMask) throw new Error('Segmenter returned no mask');
    const width = categoryMask.width;
    const height = categoryMask.height;
    const raw = categoryMask.getAsUint8Array();
    const foreground = raw[clampIndex(seed.y, height) * width + clampIndex(seed.x, width)];
    const data = new Float32Array(width * height);
    for (let i = 0; i < data.length; i++) data[i] = raw[i] === foreground ? 1 : 0;
    return { width, height, data };
  } finally {
    result.close();
  }
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Nearest mask index for a normalized 0–1 coordinate. */
function clampIndex(norm: number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.round(clamp01(norm) * (size - 1))));
}
