/**
 * Stage 2: keep only the largest connected foreground region (8-connected).
 *
 * Discards speckle and secondary blobs so a single object is traced. Internal
 * holes (background seen through, e.g. a wrench ring) are not part of the
 * foreground region and so are naturally excluded by the later outer-contour trace.
 */

import type { Mask, Point } from './types';

export interface ComponentInfo {
  readonly label: number;
  readonly area: number;
  /** Topmost-leftmost pixel — a stable contour start. */
  readonly start: Point;
}

export interface LabeledComponents {
  readonly labels: Int32Array;
  readonly components: readonly ComponentInfo[];
}

/** Label every 8-connected foreground region (used to separate card from tool). */
export function labelComponents(input: Mask): LabeledComponents {
  const { width, height, data } = input;
  const n = width * height;
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const components: ComponentInfo[] = [];
  let current = 0;

  for (let seed = 0; seed < n; seed++) {
    if (data[seed] === 0 || labels[seed] !== -1) continue;

    let sp = 0;
    stack[sp++] = seed;
    labels[seed] = current;
    let area = 0;
    const sx = seed % width;
    const start: Point = { x: sx, y: (seed - sx) / width };

    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const px = p % width;
      const py = (p - px) / width;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (data[q] === 1 && labels[q] === -1) {
            labels[q] = current;
            stack[sp++] = q;
          }
        }
      }
    }

    components.push({ label: current, area, start });
    current++;
  }

  return { labels, components };
}

/** Build a single-region mask from a labeled map (for tracing one component). */
export function maskFromLabel(
  labels: Int32Array,
  label: number,
  width: number,
  height: number
): Mask {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = labels[i] === label ? 1 : 0;
  return { width, height, data };
}

export interface LargestComponent {
  readonly mask: Mask;
  readonly area: number;
  /** Topmost-leftmost pixel of the component — a stable contour start. */
  readonly start: { readonly x: number; readonly y: number } | null;
}

export function largestComponent(input: Mask): LargestComponent {
  const { width, height, data } = input;
  const n = width * height;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);

  let bestArea = 0;
  let bestLabel = -1;
  let current = 0;

  for (let seed = 0; seed < n; seed++) {
    if (data[seed] === 0 || label[seed] !== -1) continue;

    let sp = 0;
    stack[sp++] = seed;
    label[seed] = current;
    let area = 0;

    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const px = p % width;
      const py = (p - px) / width;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (data[q] === 1 && label[q] === -1) {
            label[q] = current;
            stack[sp++] = q;
          }
        }
      }
    }

    if (area > bestArea) {
      bestArea = area;
      bestLabel = current;
    }
    current++;
  }

  const out = new Uint8Array(n);
  let start: { x: number; y: number } | null = null;
  if (bestLabel !== -1) {
    for (let p = 0; p < n; p++) {
      if (label[p] === bestLabel) {
        out[p] = 1;
        if (start === null) {
          const x = p % width;
          start = { x, y: (p - x) / width };
        }
      }
    }
  }

  return { mask: { width, height, data: out }, area: bestArea, start };
}
