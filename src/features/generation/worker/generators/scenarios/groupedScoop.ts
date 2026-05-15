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

export const groupedScoop: ScenarioCase[] = [
  defineScenario('grouped scoop', 'circle + rectangle group with scoop generates valid mesh', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({ id: 'rect-1', x: 10, y: 20, width: 20, groupId: 'g1', scoopRadius: 2 }),
        makeCutout({
          id: 'circle-1',
          shape: 'circle',
          x: 25,
          y: 20,
          width: 16,
          depth: 16,
          groupId: 'g1',
          scoopRadius: 2,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario('grouped scoop', 'two overlapping rectangles with scoop generates valid mesh', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'rect-a',
          x: 10,
          y: 15,
          width: 25,
          depth: 12,
          groupId: 'g2',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'rect-b',
          x: 20,
          y: 10,
          width: 12,
          depth: 25,
          groupId: 'g2',
          scoopRadius: 2,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario('grouped scoop', 'group with different cut depths and scoop', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'shallow',
          x: 10,
          y: 15,
          width: 20,
          cutDepth: 3,
          groupId: 'g3',
          scoopRadius: 1.5,
        }),
        makeCutout({
          id: 'deep',
          shape: 'circle',
          x: 25,
          y: 15,
          width: 14,
          depth: 14,
          cutDepth: 6,
          groupId: 'g3',
          scoopRadius: 1.5,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario(
    'grouped scoop',
    'aggressive scoop radius near maximum tests progressive fallback',
    {
      assert: 'structural',
      params: {
        ...solidBase,
        cutouts: [
          makeCutout({
            id: 'rect-big',
            x: 10,
            y: 15,
            width: 20,
            depth: 12,
            groupId: 'g4',
            scoopRadius: 5.5,
          }),
          makeCutout({
            id: 'circle-big',
            shape: 'circle',
            x: 25,
            y: 15,
            width: 12,
            depth: 12,
            groupId: 'g4',
            scoopRadius: 5.5,
          }),
        ],
      },
      forExport: true,
    }
  ),
  defineScenario('grouped scoop', 'rotated shapes in group with scoop', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'rotated-rect',
          x: 20,
          y: 20,
          width: 25,
          depth: 10,
          rotation: 45,
          groupId: 'g5',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'circle-overlap',
          shape: 'circle',
          x: 30,
          y: 20,
          width: 14,
          depth: 14,
          groupId: 'g5',
          scoopRadius: 2,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario(
    'grouped scoop',
    'group with asymmetric W/D scoop on each member generates valid mesh',
    {
      assert: 'structural',
      params: {
        ...solidBase,
        cutouts: [
          makeCutout({
            id: 'rect-split-a',
            x: 10,
            y: 15,
            width: 25,
            depth: 10,
            groupId: 'g6',
            scoopRadiusW: 3,
            scoopRadiusD: 0,
          }),
          makeCutout({
            id: 'rect-split-b',
            x: 20,
            y: 30,
            width: 10,
            depth: 25,
            groupId: 'g6',
            scoopRadiusW: 0,
            scoopRadiusD: 3,
          }),
        ],
      },
      forExport: true,
    }
  ),
  defineScenario(
    'grouped scoop',
    'group with rotated member + asymmetric W/D exercises rotation-aware classifier',
    {
      assert: 'structural',
      params: {
        ...solidBase,
        cutouts: [
          makeCutout({
            id: 'rect-rotated',
            x: 12,
            y: 18,
            width: 20,
            depth: 10,
            rotation: 30,
            groupId: 'g7',
            scoopRadiusW: 2.5,
            scoopRadiusD: 0,
          }),
          makeCutout({
            id: 'rect-anchor',
            x: 28,
            y: 20,
            width: 14,
            depth: 14,
            groupId: 'g7',
            scoopRadiusW: 0,
            scoopRadiusD: 2.5,
          }),
        ],
      },
      forExport: true,
    }
  ),
];
