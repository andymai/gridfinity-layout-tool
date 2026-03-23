import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario, makeInsert } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const combinedFeatures: ScenarioCase[] = [
  defineScenario('combined features', '2\u00d72 standard + lip + 2\u00d72 compartments + scoop', {
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '4\u00d74 magnet + label bracket + half-sockets', {
    params: {
      width: 4,
      depth: 4,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet',
        stackingLip: false,
        halfSockets: true,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '1.5\u00d72 flat + slotted + 3\u00d72 merged compartments', {
    params: {
      width: 1.5,
      depth: 2,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '2\u00d72 compartments + insert (overlap interaction)', {
    params: {
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
      inserts: [makeInsert({ shape: 'circle', width: 15, depth: 15, x: 0, y: 0 })],
    },
  }),
  defineScenario('combined features', '2\u00d72 label tabs with merged compartments', {
    params: {
      compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
  }),
  defineScenario('combined features', '2\u00d72 honeycomb walls + wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '2\u00d72 honeycomb walls + scoop cutout (front only)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        shape: 'scoop',
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '2\u00d72 honeycomb walls + funnel cutout (left-aligned)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        shape: 'funnel',
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 60, alignment: 'left' },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
    timeout: 60_000,
  }),
];
