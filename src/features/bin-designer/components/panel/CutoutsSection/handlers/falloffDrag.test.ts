import { describe, it, expect } from 'vitest';
import type { PathPoint } from '@/features/bin-designer/types';
import { MAX_PATH_POINTS } from '@/features/bin-designer/types';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import {
  FALLOFF_MAX_MM,
  FALLOFF_MIN_MM,
  falloffCommit,
  falloffPreview,
  nextFalloff,
  startFalloff,
} from './falloffDrag';

function point(x: number, y: number, overrides: Partial<PathPoint> = {}): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false, ...overrides };
}

/** A 100 × 40 box with its bottom edge cut into points every 10 mm. */
const BOX: PathPoint[] = [
  ...Array.from({ length: 11 }, (_, k) => point(k * 10, 0)),
  point(100, 40),
  point(0, 40),
];

const same = (a: PathPoint, b: PathPoint) => a.x === b.x && a.y === b.y;

describe('startFalloff', () => {
  it('spans out to the first point on each side beyond the radius', () => {
    // Grab the bottom edge at x = 45 with a 12 mm radius: points at 40 and 50
    // are inside it, 30 and 60 are the fixed ends.
    const grab = startFalloff(BOX, 4, 0.5, 12);
    expect(grab?.closed).toBe(false);
    expect(BOX[grab?.from ?? -1]).toEqual(point(30, 0));
    expect(grab?.segments).toBe(3);
    expect(grab?.weights[0]).toBe(0);
    expect(grab?.weights.at(-1)).toBe(0);
  });

  it('takes the whole ring when no point lies beyond the radius', () => {
    expect(startFalloff(BOX, 4, 0.5, 500)?.closed).toBe(true);
  });
});

describe('falloffPreview', () => {
  it('moves the grab all the way and the ends not at all', () => {
    const grab = startFalloff(BOX, 4, 0.5, 12);
    if (!grab) throw new Error('no grab');
    const moved = falloffPreview(BOX, grab, 0, -3);
    const lowest = Math.min(...moved.map((p) => p.y));
    expect(lowest).toBeCloseTo(-3, 6);
    expect(moved[0]).toEqual(point(30, 0));
    expect(moved.some((p) => same(p, point(100, 40)))).toBe(true);
  });
});

describe('falloffCommit', () => {
  const grab = startFalloff(BOX, 4, 0.5, 12);
  if (!grab) throw new Error('no grab');
  const committed = falloffCommit(BOX, grab, 0, -3);

  it('keeps every point outside the stretch as it was', () => {
    if (!committed) throw new Error('no fit');
    for (const kept of [
      point(0, 0),
      point(10, 0),
      point(20, 0),
      point(30, 0),
      point(60, 0),
      point(100, 40),
      point(0, 40),
    ]) {
      expect(committed.some((p) => same(p, kept))).toBe(true);
    }
  });

  it('stores the pulled stretch with few points, the dip at the grab', () => {
    if (!committed) throw new Error('no fit');
    expect(committed.length).toBeLessThan(BOX.length + 6);
    const outline = flattenPath(committed);
    expect(Math.min(...outline.map((p) => p.y))).toBeCloseTo(-3, 0);
  });

  it('keeps a sharp corner inside the stretch sharp', () => {
    const corner = [point(0, 0), point(20, 0), point(20, 20), point(0, 20)];
    const g = startFalloff(corner, 0, 0.9, 10);
    if (!g) throw new Error('no grab');
    const out = falloffCommit(corner, g, 1, 1);
    if (!out) throw new Error('no fit');
    const k = out.findIndex((p) => Math.abs(p.x - 20) < 1.5 && Math.abs(p.y) < 1.5);
    expect(k).toBeGreaterThanOrEqual(0);
    const tip = out[k];
    const prev = out[(k - 1 + out.length) % out.length];
    const next = out[(k + 1) % out.length];
    // The way the outline arrives at the corner and the way it leaves.
    const arrive = tip.handleIn
      ? { x: -tip.handleIn.dx, y: -tip.handleIn.dy }
      : { x: tip.x - prev.x, y: tip.y - prev.y };
    const leave = tip.handleOut
      ? { x: tip.handleOut.dx, y: tip.handleOut.dy }
      : { x: next.x - tip.x, y: next.y - tip.y };
    const turn = Math.abs(
      Math.atan2(arrive.x * leave.y - arrive.y * leave.x, arrive.x * leave.x + arrive.y * leave.y)
    );
    expect((turn * 180) / Math.PI).toBeGreaterThan(60);
  });

  it('fits a whole-ring pull under the point limit', () => {
    const g = startFalloff(BOX, 4, 0.5, 500);
    if (!g) throw new Error('no grab');
    const out = falloffCommit(BOX, g, 0, -2);
    expect(out?.length).toBeGreaterThan(2);
    expect(out?.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
  });
});

describe('nextFalloff', () => {
  it('grows and shrinks within its bounds', () => {
    expect(nextFalloff(10, true)).toBe(12.5);
    expect(nextFalloff(10, false)).toBe(8);
    expect(nextFalloff(FALLOFF_MAX_MM, true)).toBe(FALLOFF_MAX_MM);
    expect(nextFalloff(FALLOFF_MIN_MM, false)).toBe(FALLOFF_MIN_MM);
  });
});
