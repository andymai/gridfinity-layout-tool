import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const scoop: ScenarioCase[] = [
  defineScenario('scoop', '2\u00d72 scoop disabled', {
    params: { scoop: { enabled: false, radius: 'auto' as const } },
  }),
  defineScenario('scoop', '2\u00d72 scoop auto radius', {
    params: { scoop: { enabled: true, radius: 'auto' as const } },
  }),
  defineScenario('scoop', '2\u00d72 scoop radius 10mm', {
    params: { scoop: { enabled: true, radius: 10 } },
  }),
];

export const scoopLipInteraction: ScenarioCase[] = [
  defineScenario(
    'scoop + lip interaction',
    'scoop with lip (single compartment, front-row offset active)',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      },
    }
  ),
  defineScenario(
    'scoop + lip interaction',
    'scoop with lip + 2 rows (front-row offset vs interior-row)',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 0.8 },
      },
    }
  ),
];
