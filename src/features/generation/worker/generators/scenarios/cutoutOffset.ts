import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const cutoutOffset: ScenarioCase[] = [
  defineScenario('cutout offset', 'positions cutout with zero offset flush with rim', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'solid',
      cutoutConfig: { topOffset: 0 },
      cutouts: [makeCutout({ id: 'test-1', x: 10, y: 10, width: 20, cutDepth: 10 })],
    },
  }),
  defineScenario('cutout offset', 'positions cutout with 5mm offset below rim', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'solid',
      cutoutConfig: { topOffset: 5 },
      cutouts: [
        makeCutout({
          id: 'test-2',
          shape: 'circle',
          x: 10,
          y: 10,
          width: 25,
          depth: 25,
          cutDepth: 10,
        }),
      ],
    },
  }),
  defineScenario('cutout offset', 'handles maximum offset (near floor)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'solid',
      cutoutConfig: { topOffset: 34.5 },
      cutouts: [makeCutout({ id: 'test-3', x: 5, y: 5, cutDepth: 0.5, cornerRadius: 2 })],
    },
  }),
];
