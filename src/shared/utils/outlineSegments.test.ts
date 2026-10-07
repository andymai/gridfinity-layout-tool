import { describe, it, expect } from 'vitest';
import { EdgeGrid, gapAcross, proxyIndices, type Across } from './outlineSegments';

const across = (): Across => ({ gap: 0, ux: 0, uy: 0 });

describe('gapAcross', () => {
  it('measures the closest approach and points from the first segment to the second', () => {
    const out = across();
    expect(gapAcross({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 3 }, { x: 3, y: 2 }, out)).toBe(
      true
    );
    expect(out.gap).toBeCloseTo(2, 12);
    expect(out.ux).toBeCloseTo(0, 12);
    expect(out.uy).toBeCloseTo(1, 12);
  });

  it('reports crossing and touching segments as having no gap', () => {
    const out = across();
    expect(gapAcross({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }, out)).toBe(
      false
    );
    expect(gapAcross({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, out)).toBe(
      false
    );
  });
});

describe('proxyIndices', () => {
  const arc = Array.from({ length: 2000 }, (_, k) => {
    const a = (k / 2000) * Math.PI * 2;
    return { x: 10 * Math.cos(a), y: 10 * Math.sin(a) };
  });

  it('keeps every dropped vertex within the tolerance of its proxy edge', () => {
    const keep = proxyIndices(arc, 0.01, Infinity);
    expect(keep.length).toBeLessThan(arc.length / 10);
    keep.forEach((start, k) => {
      const end = keep[k + 1] ?? arc.length;
      const a = arc[start];
      const b = arc[end % arc.length];
      for (let v = start + 1; v < end; v++) {
        const p = arc[v];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const off = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
        expect(off).toBeLessThanOrEqual(0.01);
      }
    });
  });

  it('splits a proxy edge longer than the span cap', () => {
    const keep = proxyIndices(arc, 1, 2);
    keep.forEach((start, k) => {
      const end = keep[k + 1] ?? arc.length;
      const a = arc[start];
      const b = arc[end % arc.length];
      if (end - start > 1) expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(2);
    });
  });
});

describe('EdgeGrid', () => {
  it('collects the edges near a segment and none far from it', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const grid = new EdgeGrid(square, 1);
    const found: number[] = [];
    grid.collect({ x: 4, y: 0.5 }, { x: 6, y: 0.5 }, 0.5, found);
    expect(found).toContain(0);
    expect(found).not.toContain(2);
  });
});
