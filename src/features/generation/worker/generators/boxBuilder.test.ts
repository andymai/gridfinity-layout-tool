// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import { initTestKernel } from '@/test/initTestKernel';

type BuildBinBoxFn = (
  gridW: number,
  gridD: number,
  wallHeight: number,
  wallThickness: number,
  solid: boolean,
  cutoutTopOffset?: number
) => Shape3D;
type BuildTopShapeFn = (gridW: number, gridD: number, includeLip: boolean) => Shape3D;

let buildBinBox: BuildBinBoxFn;
let buildTopShape: BuildTopShapeFn;

let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };
let shapeBounds: (shape: unknown) => {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
};

beforeAll(async () => {
  const { mesh: meshFn, getBounds } = await import('brepjs');
  await initTestKernel();

  const mod = await import('./boxBuilder');
  buildBinBox = mod.buildBinBox;
  buildTopShape = mod.buildTopShape;

  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
  shapeBounds = (shape) => getBounds(shape as never);
}, 30000);

describe('buildBinBox', () => {
  it('builds a hollow 2x2 box', () => {
    const shape = buildBinBox(2, 2, 16, 1.2, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a solid 2x2 box', () => {
    const shape = buildBinBox(2, 2, 16, 1.2, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('solid box has fewer triangles than hollow box', () => {
    const hollow = meshShape(buildBinBox(2, 2, 16, 1.2, false));
    const solid = meshShape(buildBinBox(2, 2, 16, 1.2, true));
    expect(solid.triangles.length).toBeLessThan(hollow.triangles.length);
  }, 60000);

  it('builds a solid box with cutout top offset', () => {
    const shape = buildBinBox(2, 2, 16, 1.2, true, 5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a 0.5x0.5 box (minimum size)', () => {
    const shape = buildBinBox(0.5, 0.5, 9, 1.2, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildTopShape', () => {
  it('builds lip with stacking interface', () => {
    const shape = buildTopShape(2, 2, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);

  it('builds lip without stacking interface', () => {
    const shape = buildTopShape(2, 2, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds lip for a 1x1 bin', () => {
    const shape = buildTopShape(1, 1, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('lip with stacking has more triangles than without', () => {
    const withLip = meshShape(buildTopShape(2, 2, true));
    const withoutLip = meshShape(buildTopShape(2, 2, false));
    expect(withLip.triangles.length).toBeGreaterThan(withoutLip.triangles.length);
  }, 60000);

  // Regression: #1379 — lip must not overhang the box boundary on non-square bins
  it.each([
    [4, 3, '4x3'],
    [3, 4, '3x4'],
    [1, 4, '1x4'],
    [2, 3, '2x3'],
  ])(
    'rectangular %sx%s lip does not exceed box bounds',
    (gridW, gridD, _label) => {
      const SIZE = 42;
      const CLEARANCE = 0.5;
      const outerW = gridW * SIZE - CLEARANCE;
      const outerD = gridD * SIZE - CLEARANCE;

      const shape = buildTopShape(gridW, gridD, true);
      const bounds = shapeBounds(shape);
      const TOL = 0.5;

      expect(bounds.xMax - bounds.xMin).toBeLessThanOrEqual(outerW + TOL);
      expect(bounds.yMax - bounds.yMin).toBeLessThanOrEqual(outerD + TOL);
    },
    30000
  );

  // Regression: lip outer face should be flush with bin outer edge
  it('lip outer face is flush with bin wall (not tapered)', () => {
    const SIZE = 42;
    const CLEARANCE = 0.5;
    const outerW = 4 * SIZE - CLEARANCE;
    const outerD = 3 * SIZE - CLEARANCE;

    const lip = buildTopShape(4, 3, true);
    const lipBounds = shapeBounds(lip);

    // Lip X/Y extent should match outerW/outerD (flush with bin wall)
    const TOL = 0.5;
    expect(lipBounds.xMax - lipBounds.xMin).toBeGreaterThan(outerW - TOL);
    expect(lipBounds.yMax - lipBounds.yMin).toBeGreaterThan(outerD - TOL);
  }, 30000);

  // Regression: #1487 — the lip extension must include an angled support
  // face below the overhang so it can be FDM-printed without strings. The
  // sweep version produced this naturally; the original loft (#1380) only
  // built sections at Z_EXT (-1.2) and above, leaving the underside of the
  // overhang as a flat horizontal shelf with nothing below it. Verify that
  // when stacking is enabled the lip reaches down to Z = -LIP_TAPER_WIDTH
  // (-2.6mm) — at least 1mm deeper than the previous loft, which stopped
  // at -1.2 (LIP_EXTENSION) and would not pass the lower bound below.
  it('lip extends below Z_EXT with angled support (no flat overhang)', () => {
    const lipNoStack = buildTopShape(2, 2, false);
    const lipWithStack = buildTopShape(2, 2, true);
    const noStackBounds = shapeBounds(lipNoStack);
    const withStackBounds = shapeBounds(lipWithStack);

    // The added depth of the stacking lip below Z = 0 is the lip
    // extension PLUS the angled support, which spans LIP_TAPER_WIDTH
    // (2.6mm). The pre-fix loft only built the extension flange and
    // produced a delta of LIP_EXTENSION (1.2mm), which would fail the
    // lower bound below. Comparing the delta cancels out the small
    // BREP getBounds tolerance epsilon (~0.3mm) that's present in
    // both the with-stack and no-stack cases.
    const lipDepthDelta = noStackBounds.zMin - withStackBounds.zMin;
    expect(lipDepthDelta).toBeGreaterThan(2.5); // ≈ LIP_TAPER_WIDTH (2.6)
    expect(lipDepthDelta).toBeLessThan(2.7);
  }, 60000);
});
