import { expect } from 'vitest';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { applyOverrides } from '@/shared/utils/applyOverrides';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

/**
 * A variant's resolved parameters have to reach the kernel intact.
 *
 * Everything else about variants is verified against `applyOverrides`'s return
 * value, which proves the resolver, not that the result is a buildable solid.
 * Params can pass migration and validation and still generate wrong geometry;
 * that failure is invisible to bounding-box and triangle-count assertions,
 * which is why this runs the real kernel and compares the two solids.
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators variantOverrides
 */

/** Divergence-theorem volume of a closed triangle mesh. */
function meshVolume(vertices: ArrayLike<number>, triangles: ArrayLike<number>): number {
  let vol = 0;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3;
    const b = triangles[i + 1] * 3;
    const c = triangles[i + 2] * 3;
    vol +=
      (vertices[a] * (vertices[b + 1] * vertices[c + 2] - vertices[b + 2] * vertices[c + 1]) -
        vertices[a + 1] * (vertices[b] * vertices[c + 2] - vertices[b + 2] * vertices[c]) +
        vertices[a + 2] * (vertices[b] * vertices[c + 1] - vertices[b + 1] * vertices[c])) /
      6;
  }
  return Math.abs(vol);
}

const PARENT: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 5,
  style: 'solid',
  // A bin's cutouts actually cut iff `base.solid` is true. `style: 'solid'` is a
  // different setting, and with it alone the pockets are inert data: every
  // variant below would generate a byte-identical mesh and this file would pass
  // whether or not an override ever reached the kernel.
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
  cutoutConfig: { topOffset: 0 },
  cutouts: [
    // A 1/4" shank pocket, centered in the bin, exactly the reporter's case.
    makeCutout({
      id: 'shank',
      shape: 'circle',
      x: 30,
      y: 30,
      width: 6.35,
      depth: 6.35,
      cutDepth: 10,
    }),
  ],
};

/** The 1/2" variant: same body, one pocket claimed and widened. */
const HALF_INCH = applyOverrides(PARENT, {
  cutouts: { shank: { width: 12.7, depth: 12.7 } },
}).params;

export const variantOverrides: ScenarioCase[] = [
  defineScenario('variant overrides', 'a resolved variant builds a real solid', {
    assert: 'structural',
    params: HALF_INCH,
    customAssert: (result, params) => {
      // The resolver held the pocket's center rather than its corner, so the
      // widened pocket is still centered on 33.175 and not shifted to 36.35.
      const pocket = params.cutouts?.[0];
      expect(pocket?.width).toBe(12.7);
      expect((pocket?.x ?? 0) + (pocket?.width ?? 0) / 2).toBeCloseTo(33.175, 6);
      expect(result.triangleCount).toBeGreaterThan(0);
    },
    // Compared by VOLUME, not triangle count. A circle tessellates by segment
    // count, so a 6.35mm pocket and a 12.7mm one produce byte-identical
    // triangle counts: the count assertion passes whether or not the override
    // reached the kernel at all, which is precisely the class of false green
    // this test exists to avoid. A wider pocket removes more material, so the
    // variant's solid must be smaller.
    compareWith: {
      params: PARENT,
      assert: (variant, parent) => {
        const variantVolume = meshVolume(variant.vertices, variant.indices);
        const parentVolume = meshVolume(parent.vertices, parent.indices);
        expect(variantVolume).toBeGreaterThan(0);
        expect(variantVolume).toBeLessThan(parentVolume);
      },
    },
  }),

  defineScenario('variant overrides', 'a variant claiming nothing matches its parent', {
    assert: 'structural',
    params: applyOverrides(PARENT, {}).params,
    compareWith: {
      params: PARENT,
      assert: (variant, parent) => {
        expect(meshVolume(variant.vertices, variant.indices)).toBeCloseTo(
          meshVolume(parent.vertices, parent.indices),
          6
        );
      },
    },
  }),

  defineScenario('variant overrides', 'a claimed bin dimension builds', {
    assert: 'structural',
    params: applyOverrides(PARENT, { dimensions: { height: 9 } }).params,
    customAssert: (result, params) => {
      expect(params.height).toBe(9);
      expect(result.triangleCount).toBeGreaterThan(0);
    },
  }),
];
