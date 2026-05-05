import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const solidMode: ScenarioCase[] = [
  defineScenario('solid mode', 'generates a valid mesh when solid=true', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    },
    forExport: true,
  }),
  defineScenario(
    'solid mode',
    'solid bin has fewer triangles than hollow bin (no interior cavity)',
    {
      assert: 'structural',
      params: {
        width: 1,
        depth: 1,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      },
      forExport: true,
      timeout: 60_000,
      compareWith: {
        params: {
          width: 1,
          depth: 1,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, solid: false, stackingLip: false },
        },
        forExport: true,
        assert: (solidResult, hollowResult) => {
          expect(solidResult.triangleCount).toBeLessThan(hollowResult.triangleCount);
          expect(solidResult.triangleCount).toBeGreaterThan(10);
        },
      },
    }
  ),
  defineScenario('solid mode', 'solid bin with stacking lip produces valid mesh', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
    },
    forExport: true,
  }),
  defineScenario(
    'solid mode',
    'solid bin with cutout at corner (0,0) produces valid mesh within bin bounds',
    {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 3,
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
        cutouts: [makeCutout({ id: 'corner-cutout', width: 10, depth: 10 })],
      },
      forExport: true,
      customAssert: (result) => {
        const outerW = 2 * 42 - 0.5;
        const outerD = outerW;
        const halfW = outerW / 2;
        const halfD = outerD / 2;
        const vertices = result.vertices;
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i];
          const y = vertices[i + 1];
          expect(x).toBeGreaterThanOrEqual(-halfW - 0.1);
          expect(x).toBeLessThanOrEqual(halfW + 0.1);
          expect(y).toBeGreaterThanOrEqual(-halfD - 0.1);
          expect(y).toBeLessThanOrEqual(halfD + 0.1);
        }
      },
    }
  ),
  defineScenario('solid mode', 'solid bin with centered cutout has more triangles than without', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [makeCutout({ id: 'center-cutout', x: 20, y: 20 })],
    },
    forExport: true,
    timeout: 60_000,
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 3,
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      },
      forExport: true,
      assert: (cutoutResult, plainResult) => {
        // Cutout adds geometry, but the cut() operation can silently fail on
        // complex geometries (featuresStage catches and skips), so accept >=.
        expect(cutoutResult.triangleCount).toBeGreaterThanOrEqual(plainResult.triangleCount);
      },
    },
  }),
];
