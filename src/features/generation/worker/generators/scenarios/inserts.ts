import { defineScenario, makeInsert } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const inserts: ScenarioCase[] = [
  defineScenario('inserts', '2\u00d72 with circle insert', {
    params: { inserts: [makeInsert({ shape: 'circle', width: 20, depth: 20 })] },
  }),
  defineScenario('inserts', '2\u00d72 with rounded-rect insert', {
    params: {
      inserts: [makeInsert({ shape: 'rounded-rect', width: 30, depth: 20, cornerRadius: 3 })],
    },
  }),
  defineScenario('inserts', '2\u00d72 with hexagon insert', {
    params: { inserts: [makeInsert({ shape: 'hexagon', width: 20, depth: 20 })] },
  }),
  defineScenario('inserts', '2\u00d72 with rectangle insert', {
    params: { inserts: [makeInsert({ shape: 'rectangle', width: 30, depth: 20 })] },
  }),
  defineScenario('inserts', '2\u00d72 with slot insert', {
    params: { inserts: [makeInsert({ shape: 'slot', width: 30, depth: 10 })] },
  }),
];

export const multipleInserts: ScenarioCase[] = [
  defineScenario('multiple inserts', '2\u00d72 with 2 circle inserts', {
    params: {
      inserts: [
        makeInsert({ id: 'a', shape: 'circle', x: -10, y: 0, width: 20, depth: 20 }),
        makeInsert({ id: 'b', shape: 'circle', x: 10, y: 0, width: 20, depth: 20 }),
      ],
    },
  }),
];
