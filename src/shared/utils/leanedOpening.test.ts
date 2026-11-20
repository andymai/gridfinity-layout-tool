import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/shared/types/bin';
import { surfaceOpening } from './leanedOpening';

const rect = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'r',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 12,
  depth: 6,
  cutDepth: 40,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const bounds = (c: Cutout, depth = c.cutDepth) => {
  const polygon = surfaceOpening(c, depth);
  const pts = (polygon ?? [[]])[0];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
};

const cos80 = Math.cos((80 * Math.PI) / 180);
const tan80 = Math.tan((80 * Math.PI) / 180);

describe('surfaceOpening', () => {
  it('is the drawn outline for an upright pocket', () => {
    const b = bounds(rect());
    expect(b).toEqual({ minX: 0, maxX: 12, minY: 0, maxY: 6 });
  });

  it('stretches a deep leaned pocket across the lean by 1 / cos', () => {
    const b = bounds(rect({ leanDeg: 80 }));
    expect(b.minX).toBeCloseTo(0, 6);
    expect(b.maxX).toBeCloseTo(12, 6);
    expect(b.minY).toBeCloseTo(3 - 3 / cos80, 6);
    expect(b.maxY).toBeCloseTo(3 + 3 / cos80, 6);
  });

  it('ends where the tilted floor of a shallow pocket meets the surface', () => {
    const b = bounds(rect({ leanDeg: 80, cutDepth: 5 }));
    expect(b.minY).toBeCloseTo(3 - 3 / cos80, 6);
    expect(b.maxY).toBeCloseTo(3 + 5 / tan80 / cos80, 6);
    const back = bounds(rect({ leanDeg: -80, cutDepth: 5 }));
    expect(back.minY).toBeCloseTo(3 - 5 / tan80 / cos80, 6);
    expect(back.maxY).toBeCloseTo(3 + 3 / cos80, 6);
  });

  it('opens by the insertion clearance too', () => {
    const b = bounds(rect({ shape: 'slot', leanDeg: 80, clearance: 2 }));
    expect(b.maxY - b.minY).toBeCloseTo(8 / cos80, 6);
  });

  it('opens at the rim above the mouth when the pocket has an entry edge', () => {
    const b = bounds(rect({ leanDeg: 80, chamferWidth: 1 }));
    expect(b.minY).toBeCloseTo(3 - 4 / cos80, 6);
    expect(b.maxY).toBeCloseTo(3 + 3 / cos80, 6);
  });

  it('keeps a path island out of the opening', () => {
    const corner = (x: number, y: number) => ({
      x,
      y,
      handleIn: null,
      handleOut: null,
      symmetric: false,
    });
    const path = rect({
      shape: 'path',
      width: 20,
      depth: 20,
      leanDeg: 60,
      path: [corner(0, 0), corner(20, 0), corner(20, 20), corner(0, 20)],
      holes: [[corner(8, 8), corner(12, 8), corner(12, 12), corner(8, 12)]],
    });
    const polygon = surfaceOpening(path, path.cutDepth);
    expect(polygon).not.toBeNull();
    expect(polygon?.length).toBe(2);
  });

  it('turns the opening with the shape', () => {
    const b = bounds(rect({ leanDeg: 80, rotation: 90 }));
    expect(b.minX).toBeCloseTo(6 - 3 / cos80, 6);
    expect(b.maxX).toBeCloseTo(6 + 3 / cos80, 6);
    expect(b.minY).toBeCloseTo(-3, 6);
    expect(b.maxY).toBeCloseTo(9, 6);
  });
});
