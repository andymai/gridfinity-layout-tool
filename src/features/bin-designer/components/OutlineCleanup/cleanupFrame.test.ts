import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { cutoutOutlineRing } from '@/shared/utils/cutoutOutline';
import { drawnRegion, storedPatch } from './cleanupFrame';

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

const pathCutout = (path: PathPoint[], rotation: number): Cutout =>
  ({
    id: 'c',
    shape: 'path',
    x: Math.min(...path.map((p) => p.x)),
    y: Math.min(...path.map((p) => p.y)),
    width: Math.max(...path.map((p) => p.x)) - Math.min(...path.map((p) => p.x)),
    depth: Math.max(...path.map((p) => p.y)) - Math.min(...path.map((p) => p.y)),
    rotation,
    path,
  }) as unknown as Cutout;

const L = [
  corner(10, 10),
  corner(50, 10),
  corner(50, 20),
  corner(20, 20),
  corner(20, 40),
  corner(10, 40),
];

describe('cleanup frame', () => {
  it('reads an unturned outline as stored', () => {
    const region = drawnRegion(pathCutout(L, 0));
    expect(region?.outline[0]).toEqual({ x: 10, y: 10 });
  });

  // The round trip a cleanup makes: read as drawn, write back, draw again.
  it('stores a turned outline so it draws where it was cleaned', () => {
    for (const rotation of [30, -75, 90]) {
      const cutout = pathCutout(L, rotation);
      const drawn = cutoutOutlineRing(cutout) ?? [];
      // Clean nothing: hand the drawn corners straight back.
      const region = drawnRegion(cutout);
      if (!region) throw new Error('no region');
      const corners = drawn.map(([x, y]) => corner(x, y));
      const patch = storedPatch({ path: corners, holes: [] }, rotation);
      const redrawn = cutoutOutlineRing({ ...cutout, ...patch }) ?? [];
      expect(redrawn).toHaveLength(drawn.length);
      redrawn.forEach(([x, y], i) => {
        expect(x).toBeCloseTo(drawn[i][0], 6);
        expect(y).toBeCloseTo(drawn[i][1], 6);
      });
    }
  });

  it('turns handles with their points', () => {
    const curved = { ...corner(0, 0), handleOut: { dx: 10, dy: 0 } };
    const patch = storedPatch({ path: [curved, corner(10, 10), corner(0, 10)], holes: [] }, 90);
    const h = patch.path?.[0].handleOut;
    expect(Math.hypot(h?.dx ?? 0, h?.dy ?? 0)).toBeCloseTo(10, 6);
    expect(h?.dx).toBeCloseTo(0, 6);
  });
});
