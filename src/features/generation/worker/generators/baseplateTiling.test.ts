import { describe, it, expect } from 'vitest';
import { resolveBaseplateTiling, MIN_OVERTILE_TILE_MM } from './baseplateTiling';
import type { BaseplateParams } from '@/shared/types/bin';

function params(overrides: Partial<BaseplateParams>): BaseplateParams {
  return {
    width: 4,
    depth: 3,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

describe('resolveBaseplateTiling', () => {
  it('is the identity when over-tile is off', () => {
    const t = resolveBaseplateTiling(params({ overTile: false, paddingLeft: 6, paddingRight: 6 }));
    expect(t.unitsX).toBe(4);
    expect(t.unitsY).toBe(3);
    expect(t.padLeft).toBe(6);
    expect(t.padRight).toBe(6);
    expect(t.fractional).toBe(false);
    expect(t.overTiledX).toBe(false);
  });

  it('converts the padding margin into a clipped tile when over-tile is on', () => {
    // 4u*42 + 6 + 6 = 180mm span → 4 full tiles + 12mm clipped tile
    const t = resolveBaseplateTiling(params({ overTile: true, paddingLeft: 6, paddingRight: 6 }));
    expect(t.overTiledX).toBe(true);
    expect(t.padLeft).toBe(0);
    expect(t.padRight).toBe(0);
    expect(t.unitsX * 42).toBeCloseTo(180, 6);
    // Trailing fractional tile is 12mm
    expect((t.unitsX - Math.floor(t.unitsX)) * 42).toBeCloseTo(12, 6);
    expect(t.fractional).toBe(true);
  });

  it('falls back to solid padding for a sub-threshold sliver', () => {
    // total padding 4mm < MIN_OVERTILE_TILE_MM → keep padding on X
    expect(MIN_OVERTILE_TILE_MM).toBeGreaterThan(4);
    const t = resolveBaseplateTiling(params({ overTile: true, paddingLeft: 2, paddingRight: 2 }));
    expect(t.overTiledX).toBe(false);
    expect(t.unitsX).toBe(4);
    expect(t.padLeft).toBe(2);
    expect(t.padRight).toBe(2);
  });

  it('resolves the two axes independently', () => {
    // X has a 12mm leftover (over-tiled); Y has a 3mm leftover (sliver → padding)
    const t = resolveBaseplateTiling(
      params({
        overTile: true,
        paddingLeft: 6,
        paddingRight: 6,
        paddingFront: 1.5,
        paddingBack: 1.5,
      })
    );
    expect(t.overTiledX).toBe(true);
    expect(t.overTiledY).toBe(false);
    expect(t.unitsY).toBe(3);
    expect(t.padFront).toBe(1.5);
    expect(t.fractional).toBe(true);
  });

  it('adds an extra full tile when padding exceeds one grid unit', () => {
    // 4u*42 + 25 + 25 = 218mm → floor(218/42)=5 full tiles + 8mm clipped
    const t = resolveBaseplateTiling(params({ overTile: true, paddingLeft: 25, paddingRight: 25 }));
    expect(t.overTiledX).toBe(true);
    expect(Math.floor(t.unitsX)).toBe(5);
    expect((t.unitsX - 5) * 42).toBeCloseTo(8, 6);
  });
});
