// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type { LipTipStyle } from '@/shared/types/bin';
import { initTestKernel } from '@/test/initTestKernel';
import { LIP_TAPER_WIDTH, LIP_OVERLAP } from './generatorConstants';
import type * as BoxBuilder from './boxBuilder';

type BuildBinBoxFn = (
  gridW: number,
  gridD: number,
  wallHeight: number,
  wallThickness: number,
  solid: boolean,
  cutoutTopOffset?: number
) => Shape3D;
type BuildTopShapeFn = typeof BoxBuilder.buildTopShape;

let buildBinBox: BuildBinBoxFn;
let buildTopShape: BuildTopShapeFn;

let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };
let simplifies: (shape: Shape3D) => boolean;
let solidFraction: (shape: Shape3D, at: [number, number, number]) => number;
let shapeBounds: (shape: unknown) => {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
};

beforeAll(async () => {
  const {
    mesh: meshFn,
    getBounds,
    simplify,
    isOk,
    isErr,
    box,
    intersect,
    measureVolume,
    unwrap,
  } = await import('brepjs');
  await initTestKernel();

  const mod = await import('./boxBuilder');
  buildBinBox = mod.buildBinBox;
  buildTopShape = mod.buildTopShape;

  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
  shapeBounds = (shape) => getBounds(shape as never);
  simplifies = (shape) => isOk(simplify(shape));
  solidFraction = (shape, at) => {
    const SIDE = 0.4;
    const probe = box(SIDE, SIDE, SIDE, { at });
    const hit = intersect(shape, probe);
    probe.delete();
    // A probe clear of the solid intersects to nothing, reported as not 3D.
    if (isErr(hit)) {
      if (hit.error.code === 'INTERSECT_NOT_3D') return 0;
      throw new Error(`${hit.error.code}: ${hit.error.message}`);
    }
    const fraction = unwrap(measureVolume(hit.value)) / SIDE ** 3;
    hit.value.delete();
    return fraction;
  };
}, 30000);

describe('buildBinBox', () => {
  it('builds a hollow 2x2 box', () => {
    const shape = buildBinBox(2, 2, 16, 1.2, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  });

  it('builds a solid 2x2 box', () => {
    const shape = buildBinBox(2, 2, 16, 1.2, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  });

  it('solid box has fewer triangles than hollow box', () => {
    const hollow = meshShape(buildBinBox(2, 2, 16, 1.2, false));
    const solid = meshShape(buildBinBox(2, 2, 16, 1.2, true));
    expect(solid.triangles.length).toBeLessThan(hollow.triangles.length);
  }, 60000);

  it('builds a solid box with cutout top offset', () => {
    const shape = buildBinBox(2, 2, 16, 1.2, true, 5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  });

  it('builds a 0.5x0.5 box (minimum size)', () => {
    const shape = buildBinBox(0.5, 0.5, 9, 1.2, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  });
});

describe('buildTopShape', () => {
  it('builds lip with stacking interface', () => {
    const shape = buildTopShape(2, 2, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  });

  it('builds lip without stacking interface', () => {
    const shape = buildTopShape(2, 2, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  });

  it('builds lip for a 1x1 bin', () => {
    const shape = buildTopShape(1, 1, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  });

  it('lip with stacking has more triangles than without', () => {
    const withLip = meshShape(buildTopShape(2, 2, true));
    const withoutLip = meshShape(buildTopShape(2, 2, false));
    expect(withLip.triangles.length).toBeGreaterThan(withoutLip.triangles.length);
  }, 60000);

  // Regression: — lip must not overhang the box boundary on non-square bins
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
  });

  // Regression: — the lip extension must include an angled support
  // face below the overhang so it can be FDM-printed without strings. The
  // sweep version produced this naturally; the original loft only
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

    // Both arms reach below the base plane, so the delta is the difference of
    // their reaches rather than LIP_TAPER_WIDTH itself. Taking a delta also
    // cancels the BREP getBounds epsilon (~0.3mm) present in both.
    const expectedDelta = LIP_TAPER_WIDTH - LIP_OVERLAP;
    const lipDepthDelta = noStackBounds.zMin - withStackBounds.zMin;
    expect(lipDepthDelta).toBeGreaterThan(expectedDelta - 0.1);
    expect(lipDepthDelta).toBeLessThan(expectedDelta + 0.1);
  }, 60000);

  // A Nesting body merges same-domain faces across the whole bin, and OCCT's
  // unifySameDomain throws on a face two of the lip's cuts both laid down.
  // `buildTopShape` falls back to the plain lip when the notched cut throws,
  // and the plain lip merges too, so the notch has to be found first.
  it.each<LipTipStyle>(['sharp', 'round', 'chamfer', 'flat'])(
    'a notched lip with a %s tip merges its same-domain faces',
    (lipTip) => {
      const notches = { fractionalEdgeX: 'end', fractionalEdgeY: 'end' } as const;
      // 3mm in from the front face of a 3x2, past the plain lip's 2.6mm inset
      // and short of the notch's reach, 1.4mm under the notch top.
      const frontY = -(2 * 42 - 0.5) / 2 + 3;
      const onGridLine: [number, number, number] = [-21, frontY, 2];
      const midCell: [number, number, number] = [0, frontY, 2];
      for (const includeLip of [true, false]) {
        const label = `support: ${includeLip}`;
        const plain = buildTopShape(3, 2, includeLip, 42, undefined, undefined, lipTip);
        expect(solidFraction(plain, onGridLine), `${label}, plain lip`).toBe(0);
        const lip = buildTopShape(3, 2, includeLip, 42, undefined, undefined, lipTip, notches);
        expect(solidFraction(lip, onGridLine), `${label}, notch`).toBeGreaterThan(0.99);
        expect(solidFraction(lip, midCell), `${label}, mid-cell`).toBe(0);
        expect(simplifies(lip), label).toBe(true);
      }
    },
    60000
  );
});
