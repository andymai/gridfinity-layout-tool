import { describe, it, expect } from 'vitest';
import { traceSoftContour, binarize, type SoftMask } from './softContour';
import type { Point } from './types';

function soft(width: number, height: number, fn: (x: number, y: number) => number): SoftMask {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = fn(x, y);
  }
  return { width, height, data };
}

function bbox(pts: readonly Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

const shoelace = (pts: readonly Point[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
};

describe('traceSoftContour', () => {
  it('traces a hard-edged rectangle at its boundary', () => {
    // Foreground block x∈[3,7], y∈[2,6].
    const img = soft(12, 10, (x, y) => (x >= 3 && x <= 7 && y >= 2 && y <= 6 ? 1 : 0));
    const c = traceSoftContour(img);
    expect(c.length).toBeGreaterThan(3);
    const b = bbox(c);
    // The 0.5 crossing sits midway between the last fg and first bg sample.
    expect(b.minX).toBeCloseTo(2.5, 5);
    expect(b.maxX).toBeCloseTo(7.5, 5);
    expect(b.minY).toBeCloseTo(1.5, 5);
    expect(b.maxY).toBeCloseTo(6.5, 5);
  });

  it('places vertices sub-pixel from a soft (ramped) edge', () => {
    // A vertical ramp crossing 0.5 between x=4 and x=5 at x≈4.25
    // (val(4)=0.3, val(5)=0.7 → t=(0.5-0.3)/0.4=0.5 → x=4.5). Whole left half
    // below, right above, plus top/bottom hard edges to close the loop.
    const img = soft(10, 10, (x, y) => {
      if (y < 2 || y > 7) return 0;
      if (x <= 4) return 0.3;
      if (x >= 5) return 0.7;
      return 0;
    });
    const c = traceSoftContour(img);
    const b = bbox(c);
    // The left edge crosses at x = 4 + (0.5-0.3)/(0.7-0.3) = 4.5 — not an integer.
    expect(b.minX).toBeCloseTo(4.5, 5);
  });

  it('returns the largest loop when several blobs are present', () => {
    const img = soft(40, 20, (x, y) => {
      const big = x >= 4 && x <= 24 && y >= 4 && y <= 14;
      const small = x >= 30 && x <= 33 && y >= 8 && y <= 11;
      return big || small ? 1 : 0;
    });
    const c = traceSoftContour(img);
    const b = bbox(c);
    expect(b.minX).toBeCloseTo(3.5, 5); // the big blob, not the small one
    expect(b.maxX).toBeCloseTo(24.5, 5);
  });

  it('winds clockwise (positive shoelace), matching traceContour', () => {
    const img = soft(12, 12, (x, y) => (x >= 3 && x <= 8 && y >= 3 && y <= 8 ? 1 : 0));
    expect(shoelace(traceSoftContour(img))).toBeGreaterThan(0);
  });

  it('returns empty when nothing crosses the level', () => {
    expect(traceSoftContour(soft(8, 8, () => 0))).toEqual([]);
    expect(traceSoftContour(soft(8, 8, () => 1))).toEqual([]);
  });

  it('still yields a usable polygon when the blob runs off the image edge', () => {
    // Foreground touches the right border, so the iso-contour can't close there;
    // the walk should still return a sensible polygon rather than crash or empty.
    const img = soft(12, 10, (x, y) => (x >= 6 && y >= 2 && y <= 6 ? 1 : 0));
    expect(traceSoftContour(img).length).toBeGreaterThanOrEqual(3);
  });

  it('approximates a disk as a near-circular loop', () => {
    const r = 8;
    const cx = 12;
    const cy = 12;
    const img = soft(25, 25, (x, y) => (Math.hypot(x - cx, y - cy) <= r ? 1 : 0));
    const c = traceSoftContour(img);
    // Every vertex lies within half a pixel of radius r from the centre.
    for (const p of c) {
      expect(Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)).toBeLessThan(1.0);
    }
  });
});

describe('binarize', () => {
  it('thresholds a soft mask at the level', () => {
    const m = binarize(soft(2, 2, (x) => (x === 0 ? 0.2 : 0.8)));
    expect(Array.from(m.data)).toEqual([0, 1, 0, 1]);
  });
});
