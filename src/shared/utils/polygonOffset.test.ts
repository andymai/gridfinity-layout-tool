import { describe, it, expect } from 'vitest';
import {
  offsetClosedPolygon,
  offsetClosedPolygonWithinReach,
  refineForOffset,
  type Pt,
} from './polygonOffset';

const CCW_SQUARE: Pt[] = [
  { x: -5, y: -5 },
  { x: 5, y: -5 },
  { x: 5, y: 5 },
  { x: -5, y: 5 },
];

function area(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    a += p[i].x * b.y - b.x * p[i].y;
  }
  return Math.abs(a / 2);
}

describe('offsetClosedPolygon', () => {
  it('grows a square outward by the offset on every side', () => {
    const out = offsetClosedPolygon(CCW_SQUARE, 1);
    expect(out).toHaveLength(4);
    // 10×10 → 12×12.
    expect(area(out)).toBeCloseTo(144, 5);
    expect(Math.min(...out.map((p) => p.x))).toBeCloseTo(-6, 5);
    expect(Math.max(...out.map((p) => p.x))).toBeCloseTo(6, 5);
  });

  it('grows regardless of winding (clockwise input still offsets outward)', () => {
    const cw = [...CCW_SQUARE].reverse();
    const out = offsetClosedPolygon(cw, 1);
    expect(area(out)).toBeGreaterThan(area(cw));
    expect(area(out)).toBeCloseTo(144, 5);
  });

  it('preserves vertex count and 1:1 correspondence', () => {
    const poly: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(offsetClosedPolygon(poly, 0.5)).toHaveLength(poly.length);
  });

  it('is a no-op for zero offset or degenerate input', () => {
    expect(offsetClosedPolygon(CCW_SQUARE, 0)).toEqual(CCW_SQUARE);
    expect(offsetClosedPolygon([{ x: 1, y: 1 }], 1)).toHaveLength(1);
  });
});

function crosses(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const den = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(den) < 1e-10) return false;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / den;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

function selfIntersects(p: readonly Pt[]): boolean {
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (crosses(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** A 30×25 L whose inner corner is a quarter circle of `radius`, in 12 chords. */
function roundedL(radius: number): Pt[] {
  const arc: Pt[] = [];
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 - (k / 12) * (Math.PI / 2);
    arc.push({ x: 10 + radius + radius * Math.cos(a), y: 8 + radius + radius * Math.sin(a) });
  }
  return [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 8 },
    ...arc,
    { x: 10, y: 25 },
    { x: 0, y: 25 },
  ];
}

/** A U whose arms stand `gap` apart, so their offsets meet once `d > gap/2`. */
function narrowU(gap: number): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: 20 + gap, y: 0 },
    { x: 20 + gap, y: 30 },
    { x: 10 + gap, y: 30 },
    { x: 10 + gap, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 30 },
    { x: 0, y: 30 },
  ];
}

describe('offsetClosedPolygonWithinReach', () => {
  it('matches the plain miter offset wherever that offset is already simple', () => {
    for (const poly of [CCW_SQUARE, roundedL(2), narrowU(4)]) {
      const plain = offsetClosedPolygon(poly, 1.5);
      const { points, reach } = offsetClosedPolygonWithinReach(poly, 1.5);
      expect(selfIntersects(plain)).toBe(false);
      expect(reach.every((r) => r === 1.5)).toBe(true);
      points.forEach((p, i) => {
        expect(p.x).toBeCloseTo(plain[i].x, 9);
        expect(p.y).toBeCloseTo(plain[i].y, 9);
      });
    }
  });

  it('holds a notch tighter than the offset back instead of folding it', () => {
    const poly = roundedL(1);
    expect(selfIntersects(offsetClosedPolygon(poly, 1.5))).toBe(true);

    const { points, reach } = offsetClosedPolygonWithinReach(poly, 1.5);
    expect(points).toHaveLength(poly.length);
    expect(selfIntersects(points)).toBe(false);
    const arc = reach.slice(3, 3 + 13);
    expect(Math.max(...arc)).toBeLessThanOrEqual(1);
    expect(Math.min(...arc)).toBeGreaterThan(0);
    expect(reach.slice(0, 3)).toEqual([1.5, 1.5, 1.5]);
    expect(reach.slice(-2)).toEqual([1.5, 1.5]);
  });

  it('keeps two arms from growing into each other across a narrow gap', () => {
    const poly = narrowU(2);
    // The plain offset turns the gap's floor (vertex 4 to 5) around, which no
    // crossing test sees: the two walls land on one line.
    const plain = offsetClosedPolygon(poly, 1.5);
    expect(plain[5].x - plain[4].x).toBeGreaterThan(0);

    const { points, reach } = offsetClosedPolygonWithinReach(poly, 1.5);
    expect(selfIntersects(points)).toBe(false);
    expect(points[5].x - points[4].x).toBeLessThan(0);
    expect(points[6].x).toBeLessThan(points[3].x);
    expect([reach[0], reach[1], reach[2], reach[7]]).toEqual([1.5, 1.5, 1.5, 1.5]);
  });

  it('never moves a vertex past its cap', () => {
    const cap = roundedL(1).map((_, i) => (i % 2 === 0 ? 0.3 : 2));
    const { reach } = offsetClosedPolygonWithinReach(roundedL(1), 0.7, cap);
    reach.forEach((r, i) => expect(r).toBeLessThanOrEqual(Math.min(0.7, cap[i])));
  });

  it('stays simple across wobbly freeform outlines and offsets', () => {
    for (const wobble of [0.15, 0.3, 0.45]) {
      for (const lobes of [3, 5, 7]) {
        const poly: Pt[] = [];
        for (let i = 0; i < 240; i++) {
          const a = (i / 240) * Math.PI * 2;
          const r = 20 * (1 + wobble * Math.sin(lobes * a));
          poly.push({ x: r * Math.cos(a), y: 1.4 * r * Math.sin(a) });
        }
        for (const d of [0.4, 1.5, 3]) {
          const { points, reach } = offsetClosedPolygonWithinReach(poly, d);
          expect(points).toHaveLength(poly.length);
          expect(selfIntersects(points)).toBe(false);
          expect(reach.every((r) => r >= 0 && r <= d)).toBe(true);
        }
      }
    }
  });
});

describe('refineForOffset', () => {
  it('returns the outline unchanged when no vertex is held back', () => {
    expect(refineForOffset(CCW_SQUARE, 1)).toEqual(CCW_SQUARE);
  });

  it('adds a collinear vertex d in from a held-back end of a long edge', () => {
    const poly = roundedL(1);
    const refined = refineForOffset(poly, 1.5);
    const added = refined.filter((p) => !poly.some((q) => q.x === p.x && q.y === p.y));
    expect(added).toHaveLength(2);
    expect(added).toContainEqual({ x: 12.5, y: 8 });
    expect(added).toContainEqual({ x: 10, y: 10.5 });
  });
});
