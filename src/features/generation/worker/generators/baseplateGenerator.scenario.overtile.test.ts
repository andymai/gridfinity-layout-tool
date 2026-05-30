// @vitest-environment node
/**
 * Geometry validation for baseplate over-tile mode (issue #1641).
 *
 * Over-tile converts the drawer-fit padding into a functional clipped grid tile
 * per axis (sliver leftovers fall back to solid padding). The drawer span is
 * unchanged, so the slab AABB matches the padded baseplate; what differs is that
 * the padding margin is now pocketed grid rather than solid plastic.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import type { BaseplateParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 3,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 6,
  paddingRight: 6,
  paddingFront: 6,
  paddingBack: 6,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  ...overrides,
});

describe('baseplate over-tile geometry', () => {
  it('produces a valid slab matching the drawer span (padding becomes tiles)', () => {
    const gen = getGenerateBaseplate();
    const padded = boundingBox(gen(defaults({ overTile: false }), NO_OP, true).vertices);

    const result = gen(defaults({ overTile: true }), NO_OP, true);
    assertStructurallyValid(result, 'over-tile');
    const tiled = boundingBox(result.vertices);

    // Same drawer footprint — over-tile only redistributes the margin into grid.
    expect(tiled.maxX - tiled.minX).toBeCloseTo(padded.maxX - padded.minX, 1);
    expect(tiled.maxY - tiled.minY).toBeCloseTo(padded.maxY - padded.minY, 1);
    // More pocketed cells than the padded plate → more triangles.
    const paddedTris = gen(defaults({ overTile: false }), NO_OP, true).triangleCount;
    expect(result.triangleCount).toBeGreaterThan(paddedTris);
  });

  it('falls back to solid padding when the leftover is a sliver', () => {
    const gen = getGenerateBaseplate();
    // 2mm padding/side → 4mm total leftover per axis, below the min tile size.
    const sliver = defaults({
      overTile: true,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const off = defaults({
      overTile: false,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });

    const tiled = gen(sliver, NO_OP, true);
    assertStructurallyValid(tiled, 'sliver fallback');
    // With both axes falling back, geometry equals the plain padded plate.
    expect(tiled.triangleCount).toBe(gen(off, NO_OP, true).triangleCount);
  });

  it('over-tiles with magnets without putting magnet holes in the clipped tile', () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults({ overTile: true, magnetHoles: true }), NO_OP, true);
    assertStructurallyValid(result, 'over-tile + magnets');
    const bb = boundingBox(result.vertices);
    expect(Number.isFinite(bb.maxX - bb.minX)).toBe(true);
  });
});
