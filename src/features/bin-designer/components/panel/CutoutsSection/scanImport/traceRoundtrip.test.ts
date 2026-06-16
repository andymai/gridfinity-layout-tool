import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { traceImage } from '@/shared/scanTrace/traceImage';
import type { ImageDataLike } from '@/shared/scanTrace/types';
import { parseScanSvg } from './scanIngest';

/**
 * Locks the Phase 2 → Phase 1 contract: a traced silhouette SVG must parse
 * back into a path cutout spec through the same pipeline the dialog uses.
 */

function darkRect(
  w: number,
  h: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      const v = inside ? 0 : 255;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

describe('trace → scan ingest round-trip', () => {
  it('feeds a traced outline into parseScanSvg as a path cutout', () => {
    const traced = traceImage(darkRect(24, 20, 5, 16, 4, 13));
    expect(isOk(traced)).toBe(true);
    if (!isOk(traced)) return;

    const parsed = parseScanSvg(traced.value);
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) return;

    expect(parsed.value.specs).toHaveLength(1);
    expect(parsed.value.specs[0].shape).toBe('path');
    // Outline spans 11 px on its longest side; ingestion measures it back.
    expect(parsed.value.bounds.longest).toBeGreaterThan(8);
    expect(parsed.value.bounds.longest).toBeLessThan(14);
  });
});
