import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { meshTopologyStats } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { ScoopSide } from '@/shared/types/bin';

/**
 * Ramps on more than one wall (#4123).
 *
 * The case that earns its own module is ADJACENT walls: two ramps meeting in
 * the corner between them are the first overlapping pair `buildScoopRamps` has
 * ever handed `fuseAll`, and an n-way fuse of overlapping solids is the path
 * that can come back as a multi-shell sum rather than a union. That failure is
 * invisible to every ordinary check — each shell is watertight, the bounding
 * box is right, the triangle count is plausible — so these assert the Euler
 * characteristic, which counts shells and nothing else.
 *
 * χ = 2 is one closed genus-0 solid. A sum of two would read 4.
 *
 * `forExport` throughout, and it is the whole point: the draft path meshes the
 * base socket separately and concatenates it, so a perfectly good draft bin
 * reads χ = 10 and the count says nothing about the fuse. The export path is
 * the single exact solid that gets printed, which is what the claim is about.
 */
const CASES: ReadonlyArray<{ readonly label: string; readonly sides: ScoopSide[] }> = [
  { label: 'adjacent walls (front + left) share a corner', sides: ['front', 'left'] },
  { label: 'opposite walls (front + back) share nothing', sides: ['front', 'back'] },
  { label: 'all four walls, three corners deep', sides: ['front', 'back', 'left', 'right'] },
];

export const scoopMultiSide: ScenarioCase[] = CASES.map(({ label, sides }) =>
  defineScenario('scoop multi-side #4123', label, {
    assert: 'structural',
    forExport: true,
    params: {
      width: 2,
      depth: 2,
      height: 4,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto' as const, sides },
    },
    customAssert: (result) => {
      const { boundaryEdges, nonManifoldEdges, eulerCharacteristic } = meshTopologyStats(result);
      expect(boundaryEdges).toBe(0);
      // An internal membrane where two ramps meet: the corner fused as a shared
      // face instead of dissolving.
      expect(nonManifoldEdges).toBe(0);
      expect(eulerCharacteristic).toBe(2);
    },
  })
);

/**
 * A repeat in `sides` must not build the same ramp twice in the same place.
 *
 * `resolveScoopSides` de-duplicates, and this is what says so at the geometry:
 * a coincident pair fuses to a sliver rather than an error, so the mesh would
 * come back looking fine and the export would carry a zero-thickness face.
 */
export const scoopSidesDeduped: ScenarioCase[] = [
  defineScenario('scoop multi-side #4123', 'a repeated wall builds one ramp', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 2,
      depth: 2,
      height: 4,
      scoop: {
        ...DEFAULT_BIN_PARAMS.scoop,
        enabled: true,
        radius: 'auto' as const,
        sides: ['left', 'left', 'left'],
      },
    },
    customAssert: (result) => {
      const { boundaryEdges, nonManifoldEdges, eulerCharacteristic } = meshTopologyStats(result);
      expect(boundaryEdges).toBe(0);
      expect(nonManifoldEdges).toBe(0);
      expect(eulerCharacteristic).toBe(2);
    },
  }),
];
