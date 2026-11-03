import { describe, it, expect } from 'vitest';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { findCorners, fitRing, type Pt } from './runs';

/** A closed polyline through `corners`, a point every `step` mm. */
function dense(corners: readonly Pt[], step = 0.5): Pt[] {
  const out: Pt[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++)
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  });
  return out;
}

const circle = (r: number, n = 400): Pt[] =>
  Array.from({ length: n }, (_, i) => ({
    x: r * Math.cos((2 * Math.PI * i) / n),
    y: r * Math.sin((2 * Math.PI * i) / n),
  }));

const rotate = (points: readonly Pt[], deg: number): Pt[] => {
  const a = (deg * Math.PI) / 180;
  return points.map((p) => ({
    x: p.x * Math.cos(a) - p.y * Math.sin(a),
    y: p.x * Math.sin(a) + p.y * Math.cos(a),
  }));
};

const SQUARE = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
];

/** Deterministic wobble, a tenth of a millimetre either way. */
const wobble = (points: readonly Pt[]): Pt[] =>
  points.map((p, i) => ({ x: p.x + 0.1 * Math.sin(i * 1.7), y: p.y + 0.1 * Math.cos(i * 2.3) }));

describe('findCorners', () => {
  it('finds a square’s four corners and nothing along its sides', () => {
    const ring = dense(SQUARE);
    const corners = findCorners(ring, 1).map((i) => ring[i]);
    expect(corners).toHaveLength(4);
    for (const c of SQUARE) {
      expect(corners.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 0.6)).toBe(true);
    }
  });

  it('finds none round a circle', () => {
    expect(findCorners(circle(20), 1)).toEqual([]);
  });
});

describe('fitRing', () => {
  it('fits a wobbly square as its four corners, straight between them', () => {
    const path = fitRing(wobble(dense(SQUARE)), {
      tolerance: 0.3,
      curves: false,
      axisAngle: null,
      window: 1,
    });
    expect(path).toHaveLength(4);
    expect(path.every((p) => p.handleIn === null && p.handleOut === null)).toBe(true);
  });

  it('fits a circle as a few curves that stay on it', () => {
    const path = fitRing(circle(20), { tolerance: 0.1, curves: true, axisAngle: null, window: 1 });
    expect(path.length).toBeLessThan(12);
    expect(path.some((p) => p.handleOut !== null)).toBe(true);
    for (const p of flattenPath(path, 0.05)) {
      expect(Math.abs(Math.hypot(p.x, p.y) - 20)).toBeLessThan(0.15);
    }
  });

  // A half circle on a straight edge: the two corners where they meet stay
  // corners, with no handle across them, while the arc becomes curves.
  it('keeps corners sharp between curves', () => {
    const arc = Array.from({ length: 200 }, (_, i) => ({
      x: 20 * Math.cos((Math.PI * i) / 199),
      y: 20 * Math.sin((Math.PI * i) / 199),
    }));
    const edge = Array.from({ length: 79 }, (_, i) => ({ x: -20 + (40 * (i + 1)) / 80, y: 0 }));
    const path = fitRing([...arc, ...edge], {
      tolerance: 0.1,
      curves: true,
      axisAngle: null,
      window: 1,
    });
    const corner = (x: number) => path.find((p) => Math.hypot(p.x - x, p.y) < 0.2);
    for (const x of [-20, 20]) {
      const p = corner(x);
      expect(p).toBeDefined();
      // Only the arc's side carries a handle.
      expect((p?.handleIn === null) !== (p?.handleOut === null)).toBe(true);
    }
  });

  it('squares an edge a few degrees off the axes, and leaves one well off them', () => {
    const near = fitRing(wobble(dense(rotate(SQUARE, 3))), {
      tolerance: 0.3,
      curves: false,
      axisAngle: 0,
      window: 1,
    });
    expect(near).toHaveLength(4);
    near.forEach((p, i) => {
      const q = near[(i + 1) % near.length];
      expect(Math.min(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBeLessThan(1e-9);
    });

    const far = fitRing(dense(rotate(SQUARE, 20)), {
      tolerance: 0.3,
      curves: false,
      axisAngle: 0,
      window: 1,
    });
    far.forEach((p, i) => {
      const q = far[(i + 1) % far.length];
      expect(Math.min(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBeGreaterThan(1);
    });
  });

  it('squares to a tool’s own axes when given its angle', () => {
    const path = fitRing(dense(rotate(SQUARE, 32)), {
      tolerance: 0.3,
      curves: false,
      axisAngle: (30 * Math.PI) / 180,
      window: 1,
    });
    const a = path[0];
    const b = path[1];
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    // Square to the tool's 30 degrees: off it by a whole number of quarter turns.
    expect(Math.abs(((angle - 30 + 405) % 90) - 45)).toBeCloseTo(0, 6);
  });
});
