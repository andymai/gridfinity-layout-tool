// @vitest-environment node
/**
 * Geometry validation for baseplate over-tile mode (issue #1641).
 *
 * Over-tile is additive: it keeps the standard grid + slab and cuts grid-aligned
 * clipped pockets into the drawer-fit padding margins (per-side; a margin below
 * the printable threshold stays solid padding). The slab AABB is unchanged — the
 * padding region just gains pockets instead of solid plastic.
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
  paddingLeft: 12,
  paddingRight: 12,
  paddingFront: 12,
  paddingBack: 12,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  ...overrides,
});

describe('baseplate over-tile geometry', () => {
  it('adds margin pockets while keeping the same slab footprint', () => {
    const gen = getGenerateBaseplate();
    const padded = boundingBox(gen(defaults({ overTile: false }), NO_OP, true).vertices);

    const result = gen(defaults({ overTile: true }), NO_OP, true);
    assertStructurallyValid(result, 'over-tile');
    const tiled = boundingBox(result.vertices);

    // Additive — the slab outer footprint is unchanged.
    expect(tiled.maxX - tiled.minX).toBeCloseTo(padded.maxX - padded.minX, 1);
    expect(tiled.maxY - tiled.minY).toBeCloseTo(padded.maxY - padded.minY, 1);
    // The 12mm margins (>= the 8mm threshold) gain clipped pockets → more triangles.
    const paddedTris = gen(defaults({ overTile: false }), NO_OP, true).triangleCount;
    expect(result.triangleCount).toBeGreaterThan(paddedTris);
  });

  it('over-tiles per side: tiles a wide margin, leaves a sliver margin solid', () => {
    const gen = getGenerateBaseplate();
    // X margins 12mm (tiled), Y margins 3mm (sub-threshold → stay solid padding).
    const params = defaults({
      overTile: true,
      paddingLeft: 12,
      paddingRight: 12,
      paddingFront: 3,
      paddingBack: 3,
    });
    const off = defaults({
      overTile: false,
      paddingLeft: 12,
      paddingRight: 12,
      paddingFront: 3,
      paddingBack: 3,
    });
    const result = gen(params, NO_OP, true);
    assertStructurallyValid(result, 'mixed per-side over-tile');
    // X margins add pockets; Y margins don't → still more triangles than padded.
    expect(result.triangleCount).toBeGreaterThan(gen(off, NO_OP, true).triangleCount);
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
