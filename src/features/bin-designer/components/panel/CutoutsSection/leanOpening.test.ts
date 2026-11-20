import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { leanedOpeningRing, placeLeanOpenings } from './leanOpening';

const rect = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'r',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 20,
  cutDepth: 30,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const bounds = (ring: readonly { x: number; y: number }[]) => ({
  minX: Math.min(...ring.map((p) => p.x)),
  maxX: Math.max(...ring.map((p) => p.x)),
  minY: Math.min(...ring.map((p) => p.y)),
  maxY: Math.max(...ring.map((p) => p.y)),
});

describe('leanedOpeningRing', () => {
  it('has no opening to draw for an upright pocket', () => {
    expect(leanedOpeningRing(rect())).toBeNull();
  });

  it('stretches the opening across the lean by 1 / cos', () => {
    const ring = leanedOpeningRing(rect({ leanDeg: 60 }));
    expect(ring).not.toBeNull();
    const b = bounds(ring ?? []);
    expect(b.minX).toBeCloseTo(0, 9);
    expect(b.maxX).toBeCloseTo(10, 9);
    expect(b.minY).toBeCloseTo(-10, 9);
    expect(b.maxY).toBeCloseTo(30, 9);
  });

  it('stretches the same way for either lean direction', () => {
    const forward = bounds(leanedOpeningRing(rect({ leanDeg: 60 })) ?? []);
    const back = bounds(leanedOpeningRing(rect({ leanDeg: -60 })) ?? []);
    expect(back).toEqual(forward);
  });

  it('turns the opening with the shape', () => {
    const b = bounds(leanedOpeningRing(rect({ leanDeg: 60, rotation: 90 })) ?? []);
    expect(b.minX).toBeCloseTo(-15, 9);
    expect(b.maxX).toBeCloseTo(25, 9);
    expect(b.minY).toBeCloseTo(5, 9);
    expect(b.maxY).toBeCloseTo(15, 9);
  });

  it('has no opening for a shape that cannot lean', () => {
    expect(leanedOpeningRing(rect({ shape: 'knifeSlot', leanDeg: 60 }))).toBeNull();
  });
});

describe('placeLeanOpenings', () => {
  it('follows a live drag and skips hidden pockets', () => {
    const moving = rect({ id: 'm', leanDeg: 60 });
    const hidden = rect({ id: 'h', leanDeg: 60, hidden: true });
    const placed = placeLeanOpenings([moving, hidden], new Map([['m', { x: 50 }]]));
    expect(placed.map((p) => p.key)).toEqual(['m']);
    expect(bounds(placed[0].ring).minX).toBeCloseTo(50, 9);
  });

  it('draws one opening per repeat copy', () => {
    const repeated = rect({
      leanDeg: 60,
      array: {
        mode: 'grid',
        cols: 3,
        rows: 1,
        pitchX: 15,
        pitchY: 15,
        count: 3,
        radius: 20,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    expect(placeLeanOpenings([repeated], new Map())).toHaveLength(3);
  });
});
