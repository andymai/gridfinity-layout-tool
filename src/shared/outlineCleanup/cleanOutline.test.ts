import { describe, it, expect } from 'vitest';
import { MAX_PATH_POINTS } from '@/shared/types/bin';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { cleanOutline, isNoCleanup, NO_CLEANUP } from './cleanOutline';
import type { Pt } from './runs';

// A traced tool, as a scan delivers one: an L with a tenth-millimetre wobble,
// a point every quarter millimetre.
function tracedL(): Pt[] {
  const corners = [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 15 },
    { x: 15, y: 15 },
    { x: 15, y: 45 },
    { x: 0, y: 45 },
  ];
  const out: Pt[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 0.25);
    for (let k = 0; k < n; k++) {
      const j = out.length;
      out.push({
        x: a.x + ((b.x - a.x) * k) / n + 0.1 * Math.sin(j * 1.3),
        y: a.y + ((b.y - a.y) * k) / n + 0.1 * Math.cos(j * 0.7),
      });
    }
  });
  return out;
}

const finite = (points: readonly { x: number; y: number }[]) =>
  points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

describe('cleanOutline', () => {
  it('tells settings that change nothing', () => {
    expect(isNoCleanup(NO_CLEANUP)).toBe(true);
    expect(isNoCleanup({ ...NO_CLEANUP, curves: true })).toBe(false);
  });

  it('keeps a dense trace inside the path point limit', () => {
    const outline = tracedL();
    expect(outline.length).toBeGreaterThan(MAX_PATH_POINTS);
    const cleaned = cleanOutline({ outline, holes: [] }, { ...NO_CLEANUP, curves: true });
    expect(cleaned?.path.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
  });

  it('simplifies and squares a traced L back to its six corners', () => {
    const cleaned = cleanOutline(
      { outline: tracedL(), holes: [] },
      { ...NO_CLEANUP, simplify: 0.5, straighten: true }
    );
    expect(cleaned?.path).toHaveLength(6);
    const path = cleaned?.path ?? [];
    path.forEach((p, i) => {
      const q = path[(i + 1) % path.length];
      expect(Math.min(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBeLessThan(1e-9);
    });
  });

  // Rounded after the fit, the corner rounds and the edges either side stay
  // dead straight, rather than every dip in the trace's wobble filling in.
  it('rounds the inside corner of a traced L and leaves its edges straight', () => {
    const cleaned = cleanOutline(
      { outline: tracedL(), holes: [] },
      { ...NO_CLEANUP, simplify: 0.3, curves: true, straighten: true, roundInside: 3 }
    );
    if (!cleaned) throw new Error('nothing left');
    // The inner upright edge, from where the corner's arc ends up to the top.
    const innerEdge = cleaned.path.filter((p) => p.y > 17.5 && Math.abs(p.x - 15) < 1);
    expect(innerEdge.length).toBeGreaterThanOrEqual(2);
    const xs = innerEdge.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1e-9);
    const corner = cleaned.path.find((p) => Math.hypot(p.x - 15, p.y - 15) < 0.5);
    expect(corner).toBeUndefined();
  });

  it('runs every step together into a finite, closed outline', () => {
    const cleaned = cleanOutline(
      { outline: tracedL(), holes: [] },
      {
        simplify: 0.3,
        curves: true,
        straighten: true,
        mirror: { axis: 'detected', keep: 'average' },
        roundInside: 2,
      }
    );
    if (!cleaned) throw new Error('nothing left');
    expect(cleaned.path.length).toBeGreaterThanOrEqual(3);
    expect(finite(flattenPath(cleaned.path))).toBe(true);
  });

  it('gives nothing when the mirror line misses the pocket', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    // Keeping the side away from the shape leaves nothing to mirror; a real
    // axis through its middle always has a side to keep, so only a hand-made
    // setting gets here, but it must not throw.
    expect(() =>
      cleanOutline(
        { outline, holes: [] },
        { ...NO_CLEANUP, mirror: { axis: 'vertical', keep: 'low' } }
      )
    ).not.toThrow();
  });
});
