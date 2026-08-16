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

export const scoopTwoVariable: ScenarioCase[] = [
  defineScenario('scoop two-variable', '2×2 steep curved scoop (run < height)', {
    params: { scoop: { enabled: true, radius: 20, run: 8, style: 'curved' as const } },
  }),
  defineScenario('scoop two-variable', '2×2 shallow curved scoop (run > height)', {
    params: { scoop: { enabled: true, radius: 8, run: 20, style: 'curved' as const } },
  }),
  defineScenario('scoop two-variable', '2×2 straight scoop (chamfer)', {
    params: { scoop: { enabled: true, radius: 12, run: 12, style: 'straight' as const } },
  }),
  defineScenario('scoop two-variable', '2×2 steep straight scoop', {
    params: { scoop: { enabled: true, radius: 20, run: 8, style: 'straight' as const } },
  }),
];

export const scoopSides: ScenarioCase[] = [
  defineScenario('scoop side', 'scoop on the back wall', {
    params: { scoop: { enabled: true, radius: 'auto' as const, side: 'back' as const } },
  }),
  defineScenario('scoop side', 'scoop on the left wall', {
    params: { scoop: { enabled: true, radius: 'auto' as const, side: 'left' as const } },
  }),
  defineScenario('scoop side', 'scoop on the right wall', {
    params: { scoop: { enabled: true, radius: 'auto' as const, side: 'right' as const } },
  }),
  // The long-skinny case: the scoop belongs on the long wall, which
  // is only reachable once the side is selectable.
  defineScenario('scoop side', '6×1 bin scooped on the long wall', {
    params: {
      width: 6,
      depth: 1,
      scoop: { enabled: true, radius: 'auto' as const, side: 'back' as const },
    },
  }),
  defineScenario('scoop side', 'side scoop with lip (outer-wall offset active)', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const, side: 'right' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
  defineScenario('scoop side', 'left scoop across 2 columns (outer vs interior)', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const, side: 'left' as const },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
    },
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
