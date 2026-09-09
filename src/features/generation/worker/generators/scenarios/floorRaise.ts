/**
 * Raised compartment floors: a solid slab lifts one compartment's floor so
 * short items sit higher. Measured by column probe at the compartment's
 * centre, so a slab that landed in the wrong pocket, or under the floor,
 * cannot pass on volume alone.
 */
import { expect } from 'vitest';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { columnCrossings, meshVolume } from '../__kernel-tests__/meshAssertions';
import { deriveDimensions } from '../pipeline/context';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const TWO_ACROSS = { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 };

/** Highest solid surface under a compartment's centre. */
function floorTopAt(mesh: MeshData, params: BinParams, col: number, row: number): number {
  const dim = deriveDimensions(params, false);
  const { cols, rows } = params.compartments;
  const x = dim.innerOffsetX - dim.innerW / 2 + (col + 0.5) * (dim.innerW / cols);
  const y = dim.innerOffsetY - dim.innerD / 2 + (row + 0.5) * (dim.innerD / rows);
  return Math.max(...columnCrossings(mesh, x, y));
}

function nominalFloorTop(params: BinParams): number {
  const dim = deriveDimensions(params, false);
  return dim.baseOffsetZ + dim.floorThickness;
}

export const floorRaise: ScenarioCase[] = [
  defineScenario('floor raise', 'one of two compartments stands 10mm higher', {
    params: {
      width: 2,
      depth: 1,
      height: 6,
      compartments: { ...TWO_ACROSS, floorRaises: [10, null] },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      const floorTop = nominalFloorTop(params);
      expect(floorTopAt(mesh, params, 0, 0)).toBeCloseTo(floorTop + 10, 1);
      expect(floorTopAt(mesh, params, 1, 0)).toBeCloseTo(floorTop, 1);
    },
    compareWith: {
      params: { width: 2, depth: 1, height: 6, compartments: TWO_ACROSS },
      assert: (raised, plain) => {
        // One compartment's cavity, ten deep. The fuse overlap into the walls
        // is a fraction of a percent of it, so a tight band still holds.
        const cavityArea = (42 - 0.5 - 1.2 - 0.6) * (42 - 0.5 - 2 * 1.2);
        const added = meshVolume(raised) - meshVolume(plain);
        expect(added).toBeGreaterThan(cavityArea * 10 * 0.95);
        expect(added).toBeLessThan(cavityArea * 10 * 1.1);
      },
    },
  }),
  defineScenario('floor raise', 'a merged L-shaped compartment rises as one slab', {
    params: {
      width: 3,
      depth: 2,
      height: 6,
      compartments: {
        cols: 3,
        rows: 2,
        cells: [0, 0, 1, 0, 2, 3],
        thickness: 1.2,
        floorRaises: [8, null, null, null],
      },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      const floorTop = nominalFloorTop(params);
      expect(floorTopAt(mesh, params, 0, 0)).toBeCloseTo(floorTop + 8, 1);
      expect(floorTopAt(mesh, params, 1, 0)).toBeCloseTo(floorTop + 8, 1);
      expect(floorTopAt(mesh, params, 0, 1)).toBeCloseTo(floorTop + 8, 1);
      expect(floorTopAt(mesh, params, 2, 0)).toBeCloseTo(floorTop, 1);
    },
  }),
  defineScenario('floor raise', 'a finger scoop climbs from the raised floor', {
    params: {
      width: 2,
      depth: 1,
      height: 6,
      compartments: { ...TWO_ACROSS, floorRaises: [10, null] },
      scoop: { enabled: true, radius: 'auto' },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      const floorTop = nominalFloorTop(params);
      // The ramp only reaches the front wall, so the centre still reads the slab.
      expect(floorTopAt(mesh, params, 0, 0)).toBeCloseTo(floorTop + 10, 1);
    },
    compareWith: {
      params: {
        width: 2,
        depth: 1,
        height: 6,
        compartments: { ...TWO_ACROSS, floorRaises: [10, null] },
      },
      assert: (withScoop, slabOnly) => {
        expect(meshVolume(withScoop)).toBeGreaterThan(meshVolume(slabOnly) * 1.001);
      },
    },
  }),
  defineScenario('floor raise', 'a raise taller than the cavity is clamped, never a solid block', {
    params: {
      width: 2,
      depth: 1,
      height: 3,
      compartments: { ...TWO_ACROSS, floorRaises: [100, null] },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      const dim = deriveDimensions(params, false);
      const top = floorTopAt(mesh, params, 0, 0);
      expect(top).toBeGreaterThan(nominalFloorTop(params) + 1);
      expect(top).toBeLessThan(dim.baseOffsetZ + dim.wallHeight - 2);
    },
  }),
];
