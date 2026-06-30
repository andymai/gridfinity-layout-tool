import { describe, it, expect } from 'vitest';
import { triangulatePath } from './pathGeometryTriangulation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function p(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

function regularPolygon(n: number, r: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => ({
    x: r * Math.cos((2 * Math.PI * i) / n),
    y: r * Math.sin((2 * Math.PI * i) / n),
  }));
}

// ─── triangulatePath ─────────────────────────────────────────────────────────

describe('triangulatePath', () => {
  it('returns empty array for fewer than 3 points', () => {
    expect(triangulatePath([])).toEqual([]);
    expect(triangulatePath([p(0, 0)])).toEqual([]);
    expect(triangulatePath([p(0, 0), p(5, 0)])).toEqual([]);
  });

  it('output length is always a multiple of 3', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const result = triangulatePath(regularPolygon(n, 10));
      expect(result.length % 3).toBe(0);
    }
  });

  it('all indices are within [0, n-1]', () => {
    // Use a regular pentagon — earclip reliably triangulates convex regular polygons
    const pts = regularPolygon(5, 10);
    const result = triangulatePath(pts);
    expect(result.length).toBeGreaterThan(0);
    for (const idx of result) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(pts.length);
    }
  });

  it('triangle produces exactly 3 indices', () => {
    expect(triangulatePath([p(0, 0), p(10, 0), p(5, 8)])).toHaveLength(3);
  });

  it('convex quad produces 6 indices (2 triangles)', () => {
    expect(triangulatePath([p(0, 0), p(10, 0), p(10, 10), p(0, 10)])).toHaveLength(6);
  });

  it('convex hexagon produces 12 indices (4 triangles)', () => {
    // (n-2) triangles × 3 indices = (6-2)*3 = 12
    expect(triangulatePath(regularPolygon(6, 10))).toHaveLength(12);
  });

  it('CW-wound polygon triangulates to same index count as CCW', () => {
    const ccw = triangulatePath([p(0, 0), p(10, 0), p(10, 10), p(0, 10)]);
    const cw = triangulatePath([p(0, 0), p(0, 10), p(10, 10), p(10, 0)]);
    expect(cw).toHaveLength(ccw.length);
    expect(cw).toHaveLength(6);
  });

  it('collinear points (zero-area polygon) return empty array', () => {
    expect(triangulatePath([p(0, 0), p(5, 0), p(10, 0)])).toEqual([]);
  });

  it('index validity holds for a larger convex polygon', () => {
    const n = 12;
    const pts = regularPolygon(n, 20);
    const result = triangulatePath(pts);
    expect(result).toHaveLength((n - 2) * 3);
    for (const idx of result) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(n);
    }
  });

  it('near-degenerate thin triangle does not throw', () => {
    // Very thin but non-zero area — result is either valid or empty, never throws
    const result = triangulatePath([p(0, 0), p(100, 0), p(50, 0.001)]);
    expect(result.length % 3).toBe(0);
  });
});
