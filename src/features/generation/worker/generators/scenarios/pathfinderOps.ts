/**
 * Scenarios covering the Pathfinder boolean ops (subtract/intersect/exclude).
 *
 * Each scenario uses two overlapping rectangle cutouts grouped under one of
 * the new ops; the structural assertion just checks the worker produces a
 * non-broken mesh (no NaN, non-zero volume). Union is already covered by
 * `groupedScoop`.
 */

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const solidBase: Partial<BinParams> = {
  width: 2,
  depth: 2,
  height: 3,
  style: 'solid',
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
};

export const pathfinderOps: ScenarioCase[] = [
  defineScenario('pathfinder', 'subtract group: top z-index member carves a hole in the base', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'base',
          x: 10,
          y: 10,
          width: 30,
          depth: 30,
          zIndex: 0,
          groupId: 'g-sub',
          groupOp: 'subtract',
        }),
        makeCutout({
          id: 'cutter',
          x: 20,
          y: 20,
          width: 10,
          depth: 10,
          zIndex: 1,
          groupId: 'g-sub',
          groupOp: 'subtract',
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario('pathfinder', 'intersect group: only the overlap region is cut', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'a',
          x: 10,
          y: 10,
          width: 20,
          depth: 20,
          groupId: 'g-int',
          groupOp: 'intersect',
        }),
        makeCutout({
          id: 'b',
          x: 20,
          y: 20,
          width: 20,
          depth: 20,
          groupId: 'g-int',
          groupOp: 'intersect',
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario('pathfinder', 'exclude group: XOR keeps non-overlapping regions', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'a',
          x: 10,
          y: 10,
          width: 20,
          depth: 20,
          groupId: 'g-xor',
          groupOp: 'exclude',
        }),
        makeCutout({
          id: 'b',
          x: 20,
          y: 20,
          width: 20,
          depth: 20,
          groupId: 'g-xor',
          groupOp: 'exclude',
        }),
      ],
    },
    forExport: true,
  }),
];
