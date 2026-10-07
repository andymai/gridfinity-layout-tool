import { describe, it, expect } from 'vitest';
import {
  pathCutoutCut,
  pathCutoutOutline,
  pathCutoutSections,
  polylineSelfIntersects,
} from './pathCutoutOutline';
import type { Pt } from './polygonOffset';

/**
 * A pocket split by a slit between two interleaved combs, 607 points. The
 * lower comb's teeth are too shallow to survive thinning, so it straightens at
 * their tips, through the tips of the upper comb's deeper teeth.
 */
function slitZipper(): Pt[] {
  const teeth = 150;
  const pitch = 3 / teeth;
  const lower: Pt[] = [];
  const upper: Pt[] = [];
  for (let k = 0; k < teeth; k++) {
    lower.push({ x: 3 - k * pitch, y: 0.03 }, { x: 3 - (k + 0.5) * pitch, y: 0 });
    upper.push({ x: k * pitch, y: 0.1 }, { x: (k + 0.5) * pitch, y: 0.003 });
  }
  return [
    { x: 0, y: -5 },
    { x: 3, y: -5 },
    ...lower,
    { x: 0, y: 0.03 },
    ...upper,
    { x: 3, y: 0.1 },
    { x: 3, y: 5 },
    { x: -1, y: 5 },
    { x: -1, y: -5 },
  ];
}

const square: Pt[] = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

/** A 30×25 L whose inner corner is a quarter circle of `radius`, in 12 chords. */
function roundedL(radius: number): Pt[] {
  const arc = Array.from({ length: 13 }, (_, k) => {
    const a = -Math.PI / 2 - (k / 12) * (Math.PI / 2);
    return { x: 10 + radius + radius * Math.cos(a), y: 8 + radius + radius * Math.sin(a) };
  });
  return [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 8 },
    ...arc,
    { x: 10, y: 25 },
    { x: 0, y: 25 },
  ];
}

const area = (p: readonly Pt[]): number =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a.x * b.y - b.x * a.y;
    }, 0) / 2
  );

function distanceToOutline(q: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(a.x + t * dx - q.x, a.y + t * dy - q.y));
  });
  return best;
}

describe('pathCutoutSections', () => {
  it('offsets the base by the clearance and the rim by the chamfer as well', () => {
    const sections = pathCutoutSections(square, 0.5, 0.8);
    expect(sections?.base).toHaveLength(4);
    expect(sections?.rim).toHaveLength(4);
    expect(area(sections?.base ?? [])).toBeCloseTo(21 * 21, 9);
    expect(area(sections?.rim ?? [])).toBeCloseTo(22.6 * 22.6, 9);
  });

  it('uses one outline for both sections without a chamfer', () => {
    const sections = pathCutoutSections(square, 0.5, 0);
    expect(sections?.rim).toBe(sections?.base);
  });

  it('never flares the rim inward of the base at a notch too tight for either', () => {
    const outline = roundedL(0.5);
    const sections = pathCutoutSections(outline, 0.7, 0.8);
    expect(sections?.base).toHaveLength(sections?.rim.length ?? -1);
    sections?.base.forEach((b, i) => {
      const r = sections.rim[i];
      expect(distanceToOutline(r, outline)).toBeGreaterThanOrEqual(
        distanceToOutline(b, outline) - 1e-9
      );
    });
  });

  it('gives up on an outline that thinning would make cross itself', () => {
    expect(pathCutoutSections(slitZipper(), 0.5, 0)).toBeNull();
  });
});

describe('pathCutoutCut', () => {
  const corner = (p: Pt) => ({ ...p, handleIn: null, handleOut: null, symmetric: false });
  const asCutout = (points: readonly Pt[]) => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(...xs) - x,
      depth: Math.max(...ys) - y,
      path: points.map(corner),
    };
  };

  it('cuts a path that cannot be offset to its bare outline, not its box', () => {
    const cutout = asCutout(slitZipper());
    const outline = pathCutoutOutline(cutout);
    const cut = pathCutoutCut(cutout, 0.5, 0.8);
    expect(outline).not.toBeNull();
    expect(cut?.base).toEqual(outline);
    expect(cut?.rim).toEqual(outline);
  });

  it('offsets a path that can be', () => {
    expect(area(pathCutoutCut(asCutout(square), 0.5, 0)?.base ?? [])).toBeCloseTo(21 * 21, 9);
  });

  it('has nothing to cut for a degenerate path', () => {
    expect(pathCutoutCut({ ...asCutout(square), path: [] }, 0.5, 0)).toBeNull();
  });
});

/** Every non-adjacent pair compared in turn: the verdict polylineSelfIntersects must match. */
function allPairsSelfIntersects(poly: readonly Pt[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (j === n - 1 && i === 0) continue;
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
      if (Math.abs(d) < 1e-10) continue;
      const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
      const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
      const eps = 1e-6;
      if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) return true;
    }
  }
  return false;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** A 30×20 pocket whose top edge runs through `n` points, each `drop(k)` below it. */
function crowdedTop(n: number, drop: (k: number) => number): Pt[] {
  const top = Array.from({ length: n }, (_, k) => ({
    x: 16.5 - (3 * (k + 0.5)) / n,
    y: 20 - drop(k),
  }));
  return [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 },
    { x: 16.5, y: 20 },
    ...top,
    { x: 13.5, y: 20 },
    { x: 0, y: 20 },
  ];
}

/** A 0.5mm band wound `turns` times outward, 1mm between turns, in `n` points. */
function spiralBand(n: number, turns: number): Pt[] {
  const half = n / 2;
  const at = (k: number, offset: number): Pt => {
    const a = (k / (half - 1)) * turns * 2 * Math.PI;
    const r = 2 + a / (2 * Math.PI) + offset;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };
  return [
    ...Array.from({ length: half }, (_, k) => at(k, 0)),
    ...Array.from({ length: half }, (_, k) => at(half - 1 - k, 0.5)),
  ];
}

describe('polylineSelfIntersects', () => {
  const bowtie: Pt[] = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  ];

  it('finds a crossing and passes a simple outline', () => {
    expect(polylineSelfIntersects(bowtie)).toBe(true);
    expect(polylineSelfIntersects(square)).toBe(false);
    expect(polylineSelfIntersects(roundedL(3))).toBe(false);
    expect(polylineSelfIntersects(bowtie.slice(0, 3))).toBe(false);
  });

  it('passes edges that only touch or overlap', () => {
    const vertexOnEdge: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5, y: 0 },
      { x: 0, y: 10 },
    ];
    const runsAlongItself: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 8, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 5 },
    ];
    expect(polylineSelfIntersects(vertexOnEdge)).toBe(false);
    expect(polylineSelfIntersects(runsAlongItself)).toBe(false);
  });

  it('gives the all-pairs verdict on random outlines, degenerate ones included', () => {
    const rand = seeded(20261007);
    let crossing = 0;
    for (let s = 0; s < 4000; s++) {
      const n = 4 + Math.floor(rand() * 60);
      const kind = s % 5;
      const shape = Array.from({ length: n }, (_, k): Pt => {
        if (kind === 0) return { x: rand() * 50, y: rand() * 50 };
        // A small lattice lands vertices on edges and edges along each other.
        if (kind === 1) return { x: Math.floor(rand() * 5), y: Math.floor(rand() * 5) };
        // Nearly collinear across a large bed, where the test is least certain.
        if (kind === 4) {
          const t = rand() * 400;
          return { x: t, y: 0.5 * t + (rand() - 0.5) * 1e-9 };
        }
        const a = (k / n) * 2 * Math.PI + rand() * (kind === 2 ? 0.2 : 2);
        const r = 5 + rand() * 20;
        return { x: 200 + r * Math.cos(a), y: 150 + r * Math.sin(a) };
      });
      const expected = allPairsSelfIntersects(shape);
      if (expected) crossing++;
      expect(polylineSelfIntersects(shape)).toBe(expected);
    }
    expect(crossing).toBeGreaterThan(500);
    expect(crossing).toBeLessThan(3500);
  });

  it('checks a 50,000-point outline without comparing every pair', () => {
    const rand = seeded(7);
    const zigzag = crowdedTop(50000, (k) => (k % 2 === 0 ? 0 : 0.2));
    const jitter = crowdedTop(50000, () => 0.2 * rand());
    const spiral = spiralBand(50000, 50);
    for (const shape of [zigzag, jitter, spiral]) {
      const started = performance.now();
      expect(polylineSelfIntersects(shape)).toBe(false);
      expect(performance.now() - started).toBeLessThan(300);
    }
    const swapped = [...spiral];
    [swapped[100], swapped[40000]] = [swapped[40000], swapped[100]];
    const started = performance.now();
    expect(polylineSelfIntersects(swapped)).toBe(true);
    expect(performance.now() - started).toBeLessThan(300);
  });
});
