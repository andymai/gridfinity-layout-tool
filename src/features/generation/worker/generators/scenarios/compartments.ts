import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const compartments: ScenarioCase[] = [
  defineScenario('compartments', '2\u00d72 bin with 1\u00d71 (none) compartments', {
    params: { compartments: { cols: 1, rows: 1, cells: [0], thickness: 0.8 } },
  }),
  defineScenario('compartments', '2\u00d72 bin with 2\u00d72 compartments', {
    params: { compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 } },
  }),
  defineScenario('compartments', '2\u00d72 bin with 3\u00d72 merged top-left compartments', {
    params: { compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 } },
  }),
  defineScenario('compartments', '2\u00d72 bin with 4\u00d74 dense grid compartments', {
    params: {
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
    },
    timeout: 60_000,
  }),
];
