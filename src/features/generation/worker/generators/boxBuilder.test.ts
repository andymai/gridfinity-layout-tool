// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';

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

beforeAll(async () => {
  const { initFromOC, mesh: meshFn } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const mod = await import('./boxBuilder');
  buildBinBox = mod.buildBinBox;
  buildTopShape = mod.buildTopShape;

  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
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

  it('rectangular lip does not exceed box bounds', async () => {
    const { getBounds } = await import('brepjs');
    const TOLERANCE = 0.02;

    for (const [gw, gd] of [
      [1, 2],
      [1, 4],
      [2, 3],
    ] as const) {
      const lip = buildTopShape(gw, gd, true);
      const box = buildBinBox(gw, gd, 16, 1.2, false);
      const lb = getBounds(lip as never);
      const bb = getBounds(box as never);

      expect(lb.xMax - bb.xMax).toBeLessThanOrEqual(TOLERANCE);
      expect(lb.yMax - bb.yMax).toBeLessThanOrEqual(TOLERANCE);
      expect(bb.xMin - lb.xMin).toBeLessThanOrEqual(TOLERANCE);
      expect(bb.yMin - lb.yMin).toBeLessThanOrEqual(TOLERANCE);
    }
  }, 60000);
});
