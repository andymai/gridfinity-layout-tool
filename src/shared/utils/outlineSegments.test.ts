import { describe, it, expect } from 'vitest';
import {
  EdgeGrid,
  gapAcross,
  outlinesComeWithin,
  outlinesTouch,
  proxyIndices,
  type Across,
} from './outlineSegments';

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

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** A closed ring of `n` points round (cx, cy), its radius nudged by `wobble(k)`. */
function ring(
  n: number,
  r: number,
  wobble: (k: number) => number = () => 0,
  cx = 0,
  cy = 0
): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * 2 * Math.PI;
    const rk = r + wobble(k);
    return { x: cx + rk * Math.cos(a), y: cy + rk * Math.sin(a) };
  });
}

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('outlinesTouch', () => {
  it('finds two outlines that cross, and none that stay apart', () => {
    expect(
      outlinesTouch(
        ring(64, 10),
        ring(64, 10, () => 0, 15, 0)
      )
    ).toBe(true);
    expect(outlinesTouch(ring(64, 10), ring(64, 5))).toBe(false);
    expect(
      outlinesTouch(
        ring(64, 10),
        ring(64, 4, () => 0, 30, 0)
      )
    ).toBe(false);
  });

  it('counts outlines that only touch', () => {
    const beside = SQUARE.map((p) => ({ x: p.x + 10, y: p.y + 3 }));
    expect(outlinesTouch(SQUARE, beside)).toBe(true);
  });
});

describe('outlinesComeWithin', () => {
  it('reads outlines within the gap as near and ones a quarter further as apart', () => {
    expect(outlinesComeWithin(ring(64, 30), ring(64, 28), 3)).toBe(true);
    expect(outlinesComeWithin(ring(64, 30), ring(64, 26.1), 3)).toBe(false);
    expect(
      outlinesComeWithin(
        SQUARE,
        SQUARE.map((p) => ({ x: p.x + 13.8, y: p.y })),
        3
      )
    ).toBe(false);
    expect(
      outlinesComeWithin(
        SQUARE,
        SQUARE.map((p) => ({ x: p.x + 12, y: p.y })),
        3
      )
    ).toBe(true);
  });

  it('never reads two near outlines as apart, however finely they are drawn', () => {
    const rand = seeded(11);
    for (let trial = 0; trial < 200; trial++) {
      const gap = 0.5 + 3 * rand();
      const outer = ring(400, 30, () => 0.3 * rand());
      const inner = ring(400, 30 - gap * (0.2 + 0.79 * rand()));
      expect(outlinesComeWithin(inner, outer, gap)).toBe(true);
    }
  });
});

describe('two dense outlines', () => {
  it('checks nested 20,000-point outlines without comparing every pair', () => {
    const rand = seeded(5);
    const pairs = [
      [ring(20000, 30), ring(20000, 40)],
      [ring(20000, 28, () => 2 * rand()), ring(20000, 40, () => 2 * rand())],
    ];
    for (const [inner, outer] of pairs) {
      const started = performance.now();
      expect(outlinesTouch(inner, outer)).toBe(false);
      expect(outlinesComeWithin(inner, outer, 3.45)).toBe(false);
      expect(performance.now() - started).toBeLessThan(300);
    }
  });
});
