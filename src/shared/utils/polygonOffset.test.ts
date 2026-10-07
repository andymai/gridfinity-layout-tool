import { describe, it, expect } from 'vitest';
import { COINCIDENT_POINT_EPSILON } from './polyline';
import {
  MAX_OFFSET_POINTS,
  offsetClosedPolygon,
  offsetClosedPolygonWithinReach,
  refineForOffset,
  type Pt,
} from './polygonOffset';

/** refineForOffset for an outline the test expects to fit the point budget. */
function refine(points: readonly Pt[], d: number): Pt[] {
  const refined = refineForOffset(points, d);
  if (!refined) throw new Error('the outline did not fit the point budget');
  return refined;
}

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

function segmentGap2(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return (a.x + t * dx - p.x) ** 2 + (a.y + t * dy - p.y) ** 2;
}

/**
 * Whether any two non-adjacent edges cross, touch or overlap. Stricter than
 * {@link selfIntersects}, which misses two edges landing on one line.
 */
function touchesItself(p: readonly Pt[]): boolean {
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a1 = p[i];
    const a2 = p[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const b1 = p[j];
      const b2 = p[(j + 1) % n];
      if (crosses(a1, a2, b1, b2)) return true;
      const gap2 = Math.min(
        segmentGap2(a1, b1, b2),
        segmentGap2(a2, b1, b2),
        segmentGap2(b1, a1, a2),
        segmentGap2(b2, a1, a2)
      );
      if (gap2 <= 1e-14) return true;
    }
  }
  return false;
}

/** How close a point comes to the outline. */
function distanceToOutline(q: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, segmentGap2(q, poly[i], poly[(i + 1) % poly.length]));
  }
  return Math.sqrt(best);
}

/** `lobes` cosine spikes between radii 10 and 25, sampled at `n` points. */
function star(n: number, lobes: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const r = 17.5 + 7.5 * Math.cos(a * lobes);
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });
}

/** `teeth` 1mm fingers 20mm tall, 0.6mm apart, on a 6mm base; edges cut into `perEdge`. */
function comb(teeth: number, perEdge: number): Pt[] {
  const pts: Pt[] = [];
  const run = (a: Pt, b: Pt): void => {
    for (let k = 0; k < perEdge; k++) {
      const s = k / perEdge;
      pts.push({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });
    }
  };
  let x = 0;
  for (let t = 0; t < teeth; t++) {
    run({ x, y: 0 }, { x, y: 20 });
    run({ x, y: 20 }, { x: x + 1, y: 20 });
    run({ x: x + 1, y: 20 }, { x: x + 1, y: 1 });
    run({ x: x + 1, y: 1 }, { x: x + 1.6, y: 1 });
    x += 1.6;
  }
  run({ x, y: 1 }, { x, y: -5 });
  run({ x, y: -5 }, { x: 0, y: -5 });
  return pts;
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

/**
 * A 30×20 U whose slot (x 5 to 25, down to y = 5) has its inside corners
 * rounded to `left` and `right`, leaving a straight floor between them.
 */
function notch(left: number, right: number, slot = 20): Pt[] {
  const corner = (cx: number, cy: number, r: number, from: number): Pt[] =>
    Array.from({ length: 13 }, (_, k) => {
      const a = from - (k / 12) * (Math.PI / 2);
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
  return [
    { x: 0, y: 0 },
    { x: 10 + slot, y: 0 },
    { x: 10 + slot, y: 20 },
    { x: 5 + slot, y: 20 },
    ...corner(5 + slot - right, 5 + right, right, 0),
    ...corner(5 + left, 5 + left, left, -Math.PI / 2),
    { x: 5, y: 20 },
    { x: 0, y: 20 },
  ];
}

/**
 * A 30×20 rectangle whose top edge runs through `n` points jittered inside a
 * 2×2mm square, stepping steadily along x so the outline stays simple.
 */
function scribble(n: number): Pt[] {
  let seed = 12345;
  const jitter = Array.from({ length: n }, (_, k) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return { x: 16 - (2 * (k + 0.5)) / n, y: 18 + (2 * seed) / 2147483648 };
  });
  return [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 },
    { x: 16, y: 20 },
    ...jitter,
    { x: 14, y: 20 },
    { x: 0, y: 20 },
  ];
}

/** A 30×20 rectangle with a 1mm-radius bump pushed into its top, `n` points on the bump. */
function bite(n: number): Pt[] {
  const bump = Array.from({ length: n + 1 }, (_, k) => {
    const a = (k / n) * Math.PI;
    return { x: 15 + Math.cos(a), y: 20 - Math.sin(a) };
  });
  return [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, ...bump, { x: 0, y: 20 }];
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
          expect(touchesItself(points)).toBe(false);
          expect(reach.every((r) => r >= 0 && r <= d)).toBe(true);
        }
      }
    }
  });

  it('keeps the offset everywhere it can on a dense outline of tight valleys', () => {
    // 40 spikes about 1.5mm apart at mid-height: the flanks of every valley sit
    // closer than 2d, so most vertices cannot take the full offset at all.
    const poly = star(2000, 40);
    const d = 1.05;
    const { points, reach } = offsetClosedPolygonWithinReach(poly, d);
    expect(touchesItself(points)).toBe(false);
    expect(Math.min(...reach)).toBeGreaterThan(0);

    // A vertex whose full miter point stays d clear of the rest of the outline
    // harms nothing by moving the full d.
    const full = offsetClosedPolygon(poly, d);
    const free = poly.filter((_, i) => distanceToOutline(full[i], poly) >= 0.99 * d);
    expect(free.length).toBeGreaterThan(poly.length / 3);
    poly.forEach((_, i) => {
      if (distanceToOutline(full[i], poly) >= 0.99 * d) expect(reach[i]).toBeGreaterThan(0.85 * d);
    });
  });

  it('holds a comb back only inside its slots', () => {
    const poly = comb(40, 4);
    const d = 1.05;
    const { points, reach } = offsetClosedPolygonWithinReach(poly, d);
    expect(touchesItself(points)).toBe(false);
    const at = (v: number, target: number): boolean => Math.abs(v - target) < 1e-9;
    const rim = poly
      .map((p, i) => ({ p, r: reach[i] }))
      .filter(({ p }) => at(p.y, -5) || (at(p.x, 0) && p.y < 20) || (at(p.x, 64) && p.y < 1));
    expect(rim).toHaveLength(11);
    rim.forEach(({ r }) => expect(r).toBe(d));
    // Mid-height on every slot wall: two walls 0.6mm apart split the gap.
    const walls = poly
      .map((p, i) => ({ p, r: reach[i] }))
      .filter(({ p }) => at(p.y, 10) || at(p.y, 10.5));
    expect(walls).toHaveLength(80);
    walls.filter(({ p }) => p.x > 0.5 && p.x < 63).forEach(({ r }) => expect(r).toBeLessThan(0.3));
  });

  it('stays near linear on dense outlines', () => {
    // Every regeneration of a chamfered path runs refine, rim and base. A
    // drawn path reaches 2400 points and an imported SVG has no cap.
    const d = 1.05;
    const started = performance.now();
    for (const poly of [star(2400, 12), star(2400, 80), comb(40, 4)]) {
      const refined = refine(poly, d);
      const rim = offsetClosedPolygonWithinReach(refined, d);
      offsetClosedPolygonWithinReach(refined, 0.25, rim.reach);
    }
    expect(performance.now() - started).toBeLessThan(750);
  });

  it('bounds the work on a compact scribble of any size', () => {
    // Long jittered edges packed into a 2mm square sit within reach of each
    // other however the grid is cut, so only the point budget bounds them.
    const d = 1.5;
    const started = performance.now();
    const poly = scribble(10000);
    const refined = refine(poly, d);
    const rim = offsetClosedPolygonWithinReach(refined, d);
    const base = offsetClosedPolygonWithinReach(refined, 0.7, rim.reach);
    const elapsed = performance.now() - started;
    expect(refined.length).toBeLessThanOrEqual(3 * MAX_OFFSET_POINTS);
    expect(touchesItself(rim.points)).toBe(false);
    expect(touchesItself(base.points)).toBe(false);
    expect(elapsed).toBeLessThan(400);
  });

  it('gives up on an outline that thinning would make cross itself', () => {
    // A zigzag channel 0.1mm wide between two interleaved combs: any chord
    // that skips a tooth on one side cuts through a tooth of the other.
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < 300; i++) {
      left.push({ x: 0, y: i * 0.1 }, { x: 0.9, y: i * 0.1 + 0.05 });
      right.push({ x: 1, y: i * 0.1 + 0.05 }, { x: 0.1, y: i * 0.1 + 0.1 });
    }
    const zipper = [...left, { x: 0, y: 30 }, ...right.reverse()];
    expect(touchesItself(zipper)).toBe(false);
    expect(refineForOffset(zipper, 0.5)).toBeNull();
  });

  it('leaves an outline within the point budget as it is', () => {
    const poly = star(MAX_OFFSET_POINTS, 12);
    const refined = refine(poly, 1.05);
    poly.forEach((p) => expect(refined).toContainEqual(p));
  });

  it('scales near linearly with the density of a tight inside curve', () => {
    // Every point of a curve tighter than the offset sits within reach of
    // every other, and an imported SVG can sample one as densely as it likes.
    const d = 1.5;
    const chamfer = (poly: Pt[]): number => {
      const started = performance.now();
      const refined = refine(poly, d);
      const rim = offsetClosedPolygonWithinReach(refined, d);
      offsetClosedPolygonWithinReach(refined, 0.7, rim.reach);
      return performance.now() - started;
    };
    const fastest = (poly: Pt[]): number => Math.min(chamfer(poly), chamfer(poly), chamfer(poly));
    chamfer(bite(500));
    const sparse = fastest(bite(2500));
    const dense = fastest(bite(10000));
    expect(dense).toBeLessThan(500);
    expect(dense / Math.max(sparse, 1)).toBeLessThan(8);
  });
});

describe('refineForOffset', () => {
  it('returns the outline unchanged when no vertex is held back', () => {
    expect(refine(CCW_SQUARE, 1)).toEqual(CCW_SQUARE);
  });

  it('adds a collinear vertex d in from a held-back end of a long edge', () => {
    const poly = roundedL(1);
    const refined = refine(poly, 1.5);
    const added = refined.filter((p) => !poly.some((q) => q.x === p.x && q.y === p.y));
    expect(added).toHaveLength(2);
    expect(added).toContainEqual({ x: 12.5, y: 8 });
    expect(added).toContainEqual({ x: 10, y: 10.5 });
  });

  // An 18.5mm floor between two inside corners tighter than d: both of its
  // ends are held back, and its middle has room for the full offset.
  for (const [left, right] of [
    [1, 0.5],
    [0.5, 0.5],
  ]) {
    it(`gives a floor between ${left}mm and ${right}mm corners the full d across its middle`, () => {
      const d = 1.5;
      const poly = notch(left, right);
      const refined = refine(poly, d);
      const { reach } = offsetClosedPolygonWithinReach(refined, d);
      const onFloor = (p: Pt): boolean => p.y === 5 && p.x > 5 + left && p.x < 25 - right;
      const added = refined.flatMap((p, i) =>
        onFloor(p) && !poly.some((q) => q.x === p.x && q.y === p.y) ? [{ p, r: reach[i] }] : []
      );
      expect(added.map(({ p }) => p.x).sort((a, b) => a - b)).toEqual([
        5 + left + d,
        25 - right - d,
      ]);
      added.forEach(({ r }) => expect(r).toBe(d));
    });
  }

  it('takes one midpoint when the pair would sit exactly a path vertex spacing apart', () => {
    // At this scale every coordinate is a power-of-two multiple of the
    // spacing, so the floor is exactly 2d + ε long and a pair of transition
    // points would sit exactly ε apart, which dropCoincidentPoints merges.
    const eps = COINCIDENT_POINT_EPSILON;
    const d = eps / 2;
    const r = 0.0002;
    const arc = (cx: number, from: number): Pt[] =>
      Array.from({ length: 11 }, (_, k) => {
        const a = from - ((k + 1) / 12) * (Math.PI / 2);
        return { x: cx + r * Math.cos(a), y: r + r * Math.sin(a) };
      });
    const poly: Pt[] = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: 2 * eps + r, y: 1 },
      { x: 2 * eps + r, y: r },
      ...arc(2 * eps, 0),
      { x: 2 * eps, y: 0 },
      { x: 0, y: 0 },
      ...arc(0, -Math.PI / 2),
      { x: -r, y: r },
      { x: -r, y: 1 },
      { x: -1, y: 1 },
    ];
    const floor = refine(poly, d).filter((p) => p.y === 0);
    expect(floor.map((p) => p.x)).toEqual([2 * eps, eps, 0]);
  });

  it('never leaves an edge shorter than a path vertex spacing', () => {
    // A floor a hair over 2d between two held corners: one transition point d
    // in from each end would sit 1e-8mm from the other, an edge the kernel
    // rejects.
    const d = 1.5;
    const poly = notch(0.5, 0.5, 2 * d + 1 + 1e-8);
    const refined = refine(poly, d);
    expect(refined.length).toBeGreaterThan(poly.length);
    refined.forEach((p, i) => {
      const q = refined[(i + 1) % refined.length];
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeGreaterThanOrEqual(COINCIDENT_POINT_EPSILON);
    });
  });
});
