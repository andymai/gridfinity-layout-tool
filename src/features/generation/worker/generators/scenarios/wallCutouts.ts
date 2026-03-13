import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const wallCutouts: ScenarioCase[] = [
  defineScenario('wall cutouts', 'standard bin with global wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        width: 70,
        depth: 50,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'slotted bin with per-side wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'slotted',
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 80, depth: 60 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: true, width: 50, depth: 40 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'standard bin with interior wall cutouts and compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 70,
        depth: 50,
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),
];
