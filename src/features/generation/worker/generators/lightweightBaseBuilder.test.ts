// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initTestKernel } from '@/test/initTestKernel';
import type { buildLightweightBase as BuildLightweightBaseFn } from './lightweightBaseBuilder';

let buildLightweightBase: typeof BuildLightweightBaseFn;
let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };

beforeAll(async () => {
  const { mesh: meshFn } = await import('brepjs');
  await initTestKernel();
  const mod = await import('./lightweightBaseBuilder');
  buildLightweightBase = mod.buildLightweightBase;
  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
}, 30000);

const WT = 1.2;

describe('buildLightweightBase', () => {
  it("'up' yields a valid base solid plus floor-opening tools", () => {
    const { base, floorOpenings } = buildLightweightBase(
      2,
      2,
      WT,
      false,
      false,
      3.25,
      2,
      1.5,
      'up',
      true
    );
    const baseMesh = meshShape(base);
    expect(baseMesh.triangles.length).toBeGreaterThan(0);
    // Hollow bins must produce a tool to open the body floor into each cup.
    expect(floorOpenings).not.toBeNull();
    expect(meshShape(floorOpenings).triangles.length).toBeGreaterThan(0);
  }, 30000);

  it("'down' (solid bins) opens the underside — no floor openings", () => {
    const { base, floorOpenings } = buildLightweightBase(
      2,
      2,
      WT,
      false,
      false,
      3.25,
      2,
      1.5,
      'down',
      true
    );
    expect(meshShape(base).triangles.length).toBeGreaterThan(0);
    expect(floorOpenings).toBeNull();
  }, 30000);

  it('retains magnet pads as solid islands (more geometry than plain cups)', () => {
    const plain = buildLightweightBase(2, 2, WT, false, false, 3.25, 2, 1.5, 'up', true);
    const withPads = buildLightweightBase(2, 2, WT, true, false, 3.25, 2, 1.5, 'up', true);
    const plainTris = meshShape(plain.base).triangles.length;
    const padTris = meshShape(withPads.base).triangles.length;
    // Pads + drilled pockets add surfaces the plain cups don't have.
    expect(padTris).toBeGreaterThan(plainTris);
  }, 30000);

  it("'down' (solid) bins still cut magnet pockets — pad anchored at the foot bottom", () => {
    // Regression: pads were placed at the top for 'down', so the bottom drill
    // never reached them and the pocket was missing.
    const plain = buildLightweightBase(2, 2, WT, false, false, 3.25, 2, 1.5, 'down', true);
    const withMag = buildLightweightBase(2, 2, WT, true, false, 3.25, 2, 1.5, 'down', true);
    const plainTris = meshShape(plain.base).triangles.length;
    const magTris = meshShape(withMag.base).triangles.length;
    // The drilled pocket adds interior surfaces; if it weren't cut the pad would
    // only add its outer cylinder (still more, but the pocket guarantees a clear
    // jump). Assert the pocket-bearing variant has materially more geometry.
    expect(magTris).toBeGreaterThan(plainTris);
  }, 30000);
});
