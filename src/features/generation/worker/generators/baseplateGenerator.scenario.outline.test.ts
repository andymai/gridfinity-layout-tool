// @vitest-environment node
/**
 * Geometry validation for non-rectangular (outline-shaped) baseplates
 * (issue #2528).
 *
 * The outline is a closed CCW loop (plate-local mm, vertex+bulge arcs). The
 * generator keeps the cached rectangular slab-with-pockets, skips pockets in
 * cells the outline excludes, and intersects the result with the extruded
 * outline prism — so the cut-away regions must contain NO geometry at all.
 *
 * Mesh frame note: with zero padding the grid is centered on the origin, so
 * plate-local (x, y) → mesh (x − totalW/2, y − totalD/2).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate, getKernelName } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { DrawerOutline } from '@/core/types';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};
const U = 42;

/**
 * Known upstream limitation (brepkit ≤ 2.126, verified on 2.125.2 and
 * 2.126.2): the outline-clip intersect fails with "empty wire" on the
 * corner-notch L-shape — but only when a rectangular plate was generated
 * earlier in the same session (fresh-session L-shapes succeed), i.e. an
 * order-dependent cached-state corruption inside the kernel/adapter, not an
 * outline-geometry defect. occt-wasm and manifold — the export and preview
 * kernels — are correct in every order, as are ⊓/chamfer/curved/fractional
 * shapes on brepkit itself. Skipped (not pinned) because order-dependence
 * would make a throw-pin flaky; revisit with a brepkit upstream fix.
 */
const BREPKIT_CORNER_NOTCH_INTERSECT_BROKEN = getKernelName() === 'brepkit';

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 4,
  depth: 4,
  gridUnitMm: U,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  ...overrides,
});

/** Top-right 2×2-cell notch (plate-local mm). */
const L_SHAPE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

/** ⊓: 1×2-cell notch in the middle of the back edge (4×4 plate). */
const U_SHAPE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 4 * U },
    { x: 3 * U, y: 4 * U },
    { x: 3 * U, y: 2 * U },
    { x: 1 * U, y: 2 * U },
    { x: 1 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

/** Diagonal chamfer across the top-right 2×2 corner. */
const CHAMFER: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

/** Back edge bows one grid unit into the plate (sagitta 42mm arc). */
const CURVED_BACK: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 4 * U, bulge: -0.5 },
    { x: 0, y: 4 * U },
  ],
};

/** Count mesh vertices inside a 2D mesh-frame region (any Z). */
function countVerticesIn(
  vertices: Float32Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    if (x > x0 && x < x1 && y > y0 && y < y1) count++;
  }
  return count;
}

describe('baseplate outline geometry', () => {
  it.skipIf(BREPKIT_CORNER_NOTCH_INTERSECT_BROKEN)(
    'cuts the L-shape notch clean out of the plate',
    { timeout: 240_000 },
    () => {
      const gen = getGenerateBaseplate();
      // Rect-first on purpose: generating a rectangle before the shaped plate
      // is the exact sequence that trips brepkit's order-dependent intersect
      // failure (see BREPKIT_CORNER_NOTCH_INTERSECT_BROKEN) and exercises the
      // slab-cache key split on the kernels that pass.
      gen(defaults(), NO_OP, true);
      const result = gen(defaults({ outline: L_SHAPE }), NO_OP, true);
      assertStructurallyValid(result, 'L-shape');
      // The notch (plate-local [2u,4u]×[2u,4u] → mesh [0,84]×[0,84]) is empty,
      // inset past the wall vertices and the coplanar nudge.
      expect(countVerticesIn(result.vertices, 2, 2, 82, 82)).toBe(0);
      // The body keeps its full extent.
      const bb = boundingBox(result.vertices);
      expect(bb.maxX - bb.minX).toBeCloseTo(4 * U, 0);
      expect(bb.maxY - bb.minY).toBeCloseTo(4 * U, 0);
    }
  );

  it('cuts the ⊓ notch while keeping both prongs', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults({ outline: U_SHAPE }), NO_OP, true);
    assertStructurallyValid(result, 'U-shape');
    // Notch: plate-local [1u,3u]×[2u,4u] → mesh [-42,42]×[0,84].
    expect(countVerticesIn(result.vertices, -40, 2, 40, 82)).toBe(0);
    // Prongs: geometry exists near both back corners.
    expect(countVerticesIn(result.vertices, -84, 42, -44, 84)).toBeGreaterThan(0);
    expect(countVerticesIn(result.vertices, 44, 42, 84, 84)).toBeGreaterThan(0);
  });

  it('slices a diagonal chamfer, leaving the far corner empty', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults({ outline: CHAMFER }), NO_OP, true);
    assertStructurallyValid(result, 'chamfer');
    // Deep inside the cut triangle (mesh frame): the corner around (80, 80).
    expect(countVerticesIn(result.vertices, 50, 50, 84, 84)).toBe(0);
    // On the kept side of the diagonal, material remains.
    expect(countVerticesIn(result.vertices, -84, -84, 0, 0)).toBeGreaterThan(0);
  });

  it('follows a curved back edge', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults({ outline: CURVED_BACK }), NO_OP, true);
    assertStructurallyValid(result, 'curved back');
    // Arc dips to plate-local y = 3u at the center (mesh y = 42): the band
    // above it near the center must be empty.
    expect(countVerticesIn(result.vertices, -5, 45, 5, 83)).toBe(0);
    // The back corners (where the arc meets the edge) keep material.
    expect(countVerticesIn(result.vertices, -84, 60, -60, 84)).toBeGreaterThan(0);
  });

  it.skipIf(BREPKIT_CORNER_NOTCH_INTERSECT_BROKEN)(
    'keeps magnets only in fully-inside cells',
    { timeout: 240_000 },
    () => {
      const gen = getGenerateBaseplate();
      const plain = gen(defaults({ outline: L_SHAPE }), NO_OP, true);
      const magnets = gen(defaults({ outline: L_SHAPE, magnetHoles: true }), NO_OP, true);
      assertStructurallyValid(magnets, 'L-shape + magnets');
      expect(magnets.triangleCount).toBeGreaterThan(plain.triangleCount);
      // Magnet holes never appear in the notch.
      expect(countVerticesIn(magnets.vertices, 2, 2, 82, 82)).toBe(0);
    }
  );

  it('over-tile cuts outline-clipped pockets in partial cells', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const solidPartials = gen(defaults({ outline: CHAMFER }), NO_OP, true);
    const clippedPartials = gen(defaults({ outline: CHAMFER, overTile: true }), NO_OP, true);
    assertStructurallyValid(clippedPartials, 'chamfer + over-tile');
    // The diagonal-crossed cells gain pockets (clipped by the intersect).
    expect(clippedPartials.triangleCount).toBeGreaterThan(solidPartials.triangleCount);
  });

  it('composes with solidFloor', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    const result = gen(defaults({ outline: L_SHAPE, solidFloor: true }), NO_OP, true);
    assertStructurallyValid(result, 'L-shape + solidFloor');
    expect(countVerticesIn(result.vertices, 2, 2, 82, 82)).toBe(0);
  });

  it('handles a fractional axis', { timeout: 240_000 }, () => {
    const gen = getGenerateBaseplate();
    // 3.5×4 plate (147×168mm), notch in the top-right.
    const outline: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 3.5 * U, y: 0 },
        { x: 3.5 * U, y: 2 * U },
        { x: 2 * U, y: 2 * U },
        { x: 2 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const result = gen(defaults({ width: 3.5, outline }), NO_OP, true);
    assertStructurallyValid(result, 'fractional + outline');
    // Notch: plate-local [2u,3.5u]×[2u,4u] → mesh [x−73.5, y−84]: [10.5,73.5]×[0,84].
    expect(countVerticesIn(result.vertices, 12.5, 2, 71.5, 82)).toBe(0);
  });

  it('generates a partial split piece with a connectored full seam', { timeout: 240_000 }, () => {
    // What pieceToBaseplateParams emits for a shaped split piece whose
    // boundary crossing is away from the seam: piece-local outline (1×1
    // notch at the top-right) + a join edge with connectors on the left.
    // Tongue fusion happens after the outline intersect, so both must
    // coexist in one valid solid.
    const gen = getGenerateBaseplate();
    const outline: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 3 * U },
        { x: 3 * U, y: 3 * U },
        { x: 3 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const result = gen(
      defaults({
        outline,
        connectorNubs: true,
        edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      }),
      NO_OP,
      true
    );
    assertStructurallyValid(result, 'partial piece + join seam');
    // Notch empty: plate-local [3u,4u]² → mesh [42,84]².
    expect(countVerticesIn(result.vertices, 44, 44, 82, 82)).toBe(0);
    // The join-edge tongues protrude past the piece's left face.
    const bb = boundingBox(result.vertices);
    expect(bb.minX).toBeLessThan(-2 * U - 0.5);
  });

  it.skipIf(BREPKIT_CORNER_NOTCH_INTERSECT_BROKEN)(
    'scales with a non-standard grid unit',
    { timeout: 240_000 },
    () => {
      const gen = getGenerateBaseplate();
      const G = 50;
      const outline: DrawerOutline = {
        vertices: [
          { x: 0, y: 0 },
          { x: 4 * G, y: 0 },
          { x: 4 * G, y: 2 * G },
          { x: 2 * G, y: 2 * G },
          { x: 2 * G, y: 4 * G },
          { x: 0, y: 4 * G },
        ],
      };
      const result = gen(defaults({ gridUnitMm: G, outline }), NO_OP, true);
      assertStructurallyValid(result, 'gridUnitMm 50 + outline');
      expect(countVerticesIn(result.vertices, 2, 2, 98, 98)).toBe(0);
    }
  );
});
