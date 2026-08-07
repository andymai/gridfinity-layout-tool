import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const slide = (over: Partial<(typeof DEFAULT_BIN_PARAMS)['slide']>) => ({
  ...DEFAULT_BIN_PARAMS.slide,
  enabled: true,
  ...over,
});

export const slideTray: ScenarioCase[] = [
  defineScenario('slide tray', 'interior ledges on a tall bin', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      slide: slide({ railMount: 'interior', trayWidthUnits: 1 }),
    },
    timeout: 60_000,
  }),
  defineScenario('slide tray', 'rim track on a lipped bin', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      slide: slide({ railMount: 'rim', trayWidthUnits: 2 }),
    },
    timeout: 60_000,
  }),
  defineScenario('slide tray', 'rim track without a stacking lip', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      slide: slide({ railMount: 'rim' }),
    },
    timeout: 60_000,
  }),
  defineScenario('slide tray', 'interior ledges under a wall pattern', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
      slide: slide({ railMount: 'interior' }),
    },
    timeout: 90_000,
  }),
  defineScenario('slide tray', 'interior ledges under a kumiko wrap', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'mitsukude' },
      slide: slide({ railMount: 'interior' }),
    },
    timeout: 120_000,
  }),
  defineScenario('slide tray', 'interior ledges with compartments and a lid', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      slide: slide({ railMount: 'interior', railDropMm: 6 }),
    },
    timeout: 90_000,
  }),
];
