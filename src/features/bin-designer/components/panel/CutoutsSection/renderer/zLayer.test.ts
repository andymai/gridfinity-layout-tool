import { describe, it, expect } from 'vitest';
import { zLayerOf, shapePosZ, shapeRenderOrder } from './zLayer';
import { RENDER_ORDER, Z_LAYER_MAX } from './constants';

describe('zLayerOf', () => {
  it('treats an absent zIndex as the bottom layer', () => {
    expect(zLayerOf(undefined)).toBe(0);
  });

  it('clamps negatives to the bottom', () => {
    expect(zLayerOf(-5)).toBe(0);
  });

  it('clamps past the ceiling', () => {
    expect(zLayerOf(Z_LAYER_MAX + 100)).toBe(Z_LAYER_MAX);
  });
});

describe('shapePosZ', () => {
  it('puts a higher layer closer to the camera', () => {
    expect(shapePosZ(1, 100)).toBeGreaterThan(shapePosZ(0, 100));
  });

  it('lets z-order beat the smaller-shape tiebreaker', () => {
    // A huge shape one layer up must still out-rank a tiny shape below it,
    // otherwise "bring to front" loses to the area heuristic.
    const bigOnTop = shapePosZ(1, 10_000);
    const tinyBelow = shapePosZ(0, 1);
    expect(bigOnTop).toBeGreaterThan(tinyBelow);
  });

  it('falls back to smaller-shape-wins within one layer', () => {
    expect(shapePosZ(0, 1)).toBeGreaterThan(shapePosZ(0, 10_000));
  });

  it('stays well inside the camera near plane at the ceiling', () => {
    // Camera sits at z=100 with near=0.1, so anything at/after 99.9 vanishes.
    expect(shapePosZ(Z_LAYER_MAX, 1)).toBeLessThan(99.9);
  });
});

describe('shapeRenderOrder', () => {
  it('raises a higher layer within its band', () => {
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, 3, 100)).toBeGreaterThan(
      shapeRenderOrder(RENDER_ORDER.SHAPES, 1, 100)
    );
  });

  it('never bleeds a SHAPES-band offset into GROUP_FILL', () => {
    // Worst case: top layer AND the largest possible tiebreak.
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, Z_LAYER_MAX, 1)).toBeLessThan(
      RENDER_ORDER.GROUP_FILL
    );
  });

  it('a tiebreak never promotes a shape past the next layer', () => {
    const topOfLayer = shapeRenderOrder(RENDER_ORDER.SHAPES, 1, 1);
    const bottomOfNext = shapeRenderOrder(RENDER_ORDER.SHAPES, 2, Number.POSITIVE_INFINITY);
    expect(topOfLayer).toBeLessThan(bottomOfNext);
  });

  it('lets z-order beat the area tiebreaker', () => {
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, 1, 10_000)).toBeGreaterThan(
      shapeRenderOrder(RENDER_ORDER.SHAPES, 0, 1)
    );
  });

  it('keeps the band floor for a zero-area-rank shape at the bottom layer', () => {
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, 0, Number.POSITIVE_INFINITY)).toBe(
      RENDER_ORDER.SHAPES
    );
  });
});

describe('paint order matches click order', () => {
  // The whole point of deriving both channels from one key: whichever shape
  // wins the raycast must also be the one drawn on top, or you click a shape
  // that is visually underneath.
  const cases: [string, number | undefined, number][] = [
    ['bottom layer, large', 0, 10_000],
    ['bottom layer, small', 0, 4],
    ['bottom layer, tiny', 0, 1],
    ['upper layer, large', 2, 10_000],
    ['upper layer, small', 2, 4],
    ['no zIndex, medium', undefined, 250],
  ];

  it.each(cases)('ranks %s consistently in both channels', (_label, z, area) => {
    for (const [, otherZ, otherArea] of cases) {
      const zWins = shapePosZ(z, area) > shapePosZ(otherZ, otherArea);
      const paintWins =
        shapeRenderOrder(RENDER_ORDER.SHAPES, z, area) >
        shapeRenderOrder(RENDER_ORDER.SHAPES, otherZ, otherArea);
      expect(zWins).toBe(paintWins);
    }
  });
});
