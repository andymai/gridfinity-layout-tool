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
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, 3)).toBeGreaterThan(
      shapeRenderOrder(RENDER_ORDER.SHAPES, 1)
    );
  });

  it('never bleeds a SHAPES-band offset into GROUP_FILL', () => {
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, Z_LAYER_MAX)).toBeLessThan(
      RENDER_ORDER.GROUP_FILL
    );
  });

  it('keeps the band floor for the bottom layer', () => {
    expect(shapeRenderOrder(RENDER_ORDER.SHAPES, 0)).toBe(RENDER_ORDER.SHAPES);
  });
});
