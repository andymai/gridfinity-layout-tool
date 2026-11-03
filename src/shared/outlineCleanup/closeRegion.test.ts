import { describe, it, expect } from 'vitest';
import { pointInPolygon } from '@/shared/scanTrace/toolBlobs';
import { closeRegion } from './closeRegion';
import type { Pt } from './runs';

// An L-shaped pocket: its one inside corner is at (10, 10).
const L: Pt[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 10 },
  { x: 10, y: 10 },
  { x: 10, y: 40 },
  { x: 0, y: 40 },
];

const area = (ring: readonly Pt[]): number =>
  Math.abs(
    ring.reduce((s, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return s + p.x * q.y - q.x * p.y;
    }, 0)
  ) / 2;

describe('closeRegion', () => {
  it('rounds the inside corner to the radius', () => {
    const closed = closeRegion({ outline: L, holes: [] }, 3);
    if (!closed) throw new Error('vanished');
    const { outline } = closed.region;
    // In the corner, beyond the arc centred at (13, 13): now pocket.
    expect(pointInPolygon({ x: 10.4, y: 10.4 }, outline)).toBe(true);
    // Inside the arc: still plastic.
    expect(pointInPolygon({ x: 12.2, y: 12.2 }, outline)).toBe(false);
  });

  it('never takes pocket away, and leaves the outside corners sharp', () => {
    const closed = closeRegion({ outline: L, holes: [] }, 3);
    if (!closed) throw new Error('vanished');
    const { outline } = closed.region;
    const tol = closed.pixel;
    for (const p of [
      { x: 0.2, y: 0.2 },
      { x: 39.8, y: 0.2 },
      { x: 39.8, y: 9.8 },
      { x: 0.2, y: 39.8 },
      { x: 9.8, y: 39.8 },
    ]) {
      expect(pointInPolygon(p, outline)).toBe(true);
    }
    for (const c of [
      { x: 40, y: 0 },
      { x: 0, y: 40 },
    ]) {
      expect(Math.min(...outline.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))).toBeLessThan(tol);
    }
  });

  it('rounds an island’s corners, the pocket’s inside corners round it', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const island = [
      { x: 15, y: 15 },
      { x: 25, y: 15 },
      { x: 25, y: 25 },
      { x: 15, y: 25 },
    ];
    const closed = closeRegion({ outline, holes: [island] }, 2);
    if (!closed) throw new Error('vanished');
    expect(closed.region.holes).toHaveLength(1);
    const kept = area(closed.region.holes[0]);
    // Each corner loses a square less a quarter disc: 4 (1 - pi / 4) r^2.
    expect(kept).toBeCloseTo(100 - 4 * (1 - Math.PI / 4) * 4, 0);
  });

  // A photo's speck filter would drop an island this small next to so large a
  // pocket; here only the radius decides.
  it('keeps a small island the radius leaves standing', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 150 },
      { x: 0, y: 150 },
    ];
    const island = [
      { x: 70, y: 70 },
      { x: 73, y: 70 },
      { x: 73, y: 73 },
      { x: 70, y: 73 },
    ];
    expect(closeRegion({ outline, holes: [island] }, 0.5)?.region.holes).toHaveLength(1);
  });

  it('fills in an island too thin for the radius', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const sliver = [
      { x: 19.5, y: 10 },
      { x: 20.5, y: 10 },
      { x: 20.5, y: 30 },
      { x: 19.5, y: 30 },
    ];
    expect(closeRegion({ outline, holes: [sliver] }, 2)?.region.holes).toEqual([]);
  });
});
