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
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
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

  it('places magnets in the clipped over-tile margin tiles', () => {
    const gen = getGenerateBaseplate();
    // Lightweight off so the only magnet-diameter-dependent geometry is the
    // magnet holes themselves. The 12mm margin tiles fit a centered 6.5mm magnet
    // but not a 13mm one (reach 6.5/2 + clearance > the 6mm half-tile). A
    // cylinder's triangle count is radius-independent, and nominal full-cell
    // magnets are placed in BOTH cases, so the triangle delta is exactly the
    // margin-tile magnets that fit only in the smaller-magnet build.
    const base = {
      overTile: true,
      magnetHoles: true,
      lightweight: false,
      paddingLeft: 12,
      paddingRight: 12,
      paddingFront: 12,
      paddingBack: 12,
    } as const;
    const fits = gen(defaults({ ...base, magnetDiameter: 6.5 }), NO_OP, true);
    const tooBig = gen(defaults({ ...base, magnetDiameter: 13 }), NO_OP, true);

    // Both builds must be watertight/manifold — a raw triangleCount comparison
    // would silently pass even if cutting the oversized magnet produced a torn
    // mesh, so validate the tooBig result too (not just fits).
    assertStructurallyValid(fits, 'over-tile + margin magnets (fit)');
    assertStructurallyValid(tooBig, 'over-tile + margin magnets (too big)');
    expect(fits.triangleCount).toBeGreaterThan(tooBig.triangleCount);
  });

  it('over-tile half-grid keeps a solid leftover consistent across pockets and magnets', () => {
    // Regression for the frameCells duplication: magnets/floor cutters must use
    // the SAME over-tile decomposition as the pockets, including the
    // overTileHalfGridSolidLeftover flag. Otherwise magnets get cut where no
    // pocket exists, producing a torn mesh. Exercise the half-grid +
    // solid-leftover + magnets path end-to-end and require a valid solid.
    const gen = getGenerateBaseplate();
    const base = {
      overTile: true,
      overTileHalfGrid: true,
      magnetHoles: true,
      paddingLeft: 30,
      paddingRight: 30,
      paddingFront: 30,
      paddingBack: 30,
    } as const;

    const solidLeftover = gen(
      defaults({ ...base, overTileHalfGridSolidLeftover: true }),
      NO_OP,
      true
    );
    const tiledLeftover = gen(
      defaults({ ...base, overTileHalfGridSolidLeftover: false }),
      NO_OP,
      true
    );

    assertStructurallyValid(solidLeftover, 'over-tile half-grid solid leftover + magnets');
    assertStructurallyValid(tiledLeftover, 'over-tile half-grid tiled leftover + magnets');
    // Keeping the leftover solid removes its pocket + magnets, so it must not
    // add geometry beyond the fully-tiled variant.
    expect(solidLeftover.triangleCount).toBeLessThanOrEqual(tiledLeftover.triangleCount);
  });
});
