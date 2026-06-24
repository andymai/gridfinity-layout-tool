import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

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
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 80, depth: 60 },
        back: DISABLED_WALL_CUTOUT,
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 40 },
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
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
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'interior divider cutout honours alignment + offset (#2323)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        // Reporter's linked config: left + right outer walls and the divider all
        // share a left-aligned, +5mm-offset window.
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: { enabled: true, width: 40, depth: 50, alignment: 'left', offset: 5, widthMm: null },
        right: { enabled: true, width: 40, depth: 50, alignment: 'left', offset: 5, widthMm: null },
        interior: {
          enabled: true,
          width: 40,
          depth: 50,
          alignment: 'left',
          offset: 5,
          widthMm: null,
        },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'tilted interior divider cutout with alignment (#2323)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      compartments: {
        cols: 2,
        rows: 1,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -15, offsetEnd: 15 }],
      },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        // Right-aligned window on a tilted divider exercises the true-length
        // span + the along-wall offset projection.
        interior: {
          enabled: true,
          width: 50,
          depth: 50,
          alignment: 'right',
          offset: 0,
          widthMm: null,
        },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'left-aligned cutout with offset and absolute mm width', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 70, depth: 50, alignment: 'left', offset: 5, widthMm: 30 },
        back: { enabled: true, width: 70, depth: 50, alignment: 'right', offset: 0, widthMm: null },
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
    timeout: 60_000,
  }),
];
