import { describe, it, expect } from 'vitest';
import { railPosition } from './railPosition';
import type { MarginMeshEntry } from '../../store/baseplatePageStore';

type RailGeom = Pick<MarginMeshEntry, 'side' | 'worldOffsetMm' | 'bandThicknessMm' | 'col' | 'row'>;

const rail = (over: Partial<RailGeom> = {}): RailGeom => ({
  side: 'front',
  worldOffsetMm: { x: 0, y: -10 },
  bandThicknessMm: 10,
  col: 0,
  row: 0,
  ...over,
});

describe('railPosition', () => {
  it('uses the assembled world offset by default', () => {
    expect(railPosition(rail({ worldOffsetMm: { x: 3, y: -10 } }), false)).toEqual({
      x: 3,
      y: -10,
    });
  });

  it('steps outward along the side normal when exploded', () => {
    const pos = railPosition(rail({ side: 'front', worldOffsetMm: { x: 0, y: -10 } }), true);
    expect(pos.x).toBe(0);
    expect(pos.y).toBeLessThan(-10);
  });

  it('re-anchors the normal axis outside the stack tower field (#2641)', () => {
    // front rail (band 10mm) on a 200mm-deep field: y = -(100 + 5 + gap 8) = -113.
    const front = railPosition(rail({ worldOffsetMm: { x: 42, y: -10 } }), false, {
      widthMm: 300,
      depthMm: 200,
    });
    expect(front).toEqual({ x: 42, y: -113 });

    const right = railPosition(rail({ side: 'right', worldOffsetMm: { x: 90, y: 21 } }), false, {
      widthMm: 300,
      depthMm: 200,
    });
    expect(right).toEqual({ x: 163, y: 21 });
  });

  it('ignores exploded offsets while the stack field is active', () => {
    const field = { widthMm: 300, depthMm: 200 };
    expect(railPosition(rail(), true, field)).toEqual(railPosition(rail(), false, field));
  });
});
