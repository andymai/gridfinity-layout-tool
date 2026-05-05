import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_SIDE,
  DISABLED_WALL_CUTOUT,
} from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

/** Shorthand for enabled handle side with nullable overrides */
const ENABLED_SIDE = { ...DEFAULT_HANDLE_SIDE, enabled: true } as const;

export const handles: ScenarioCase[] = [
  defineScenario('handles', 'standard bin with front + side handle holes', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with label tabs (back suppression)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        back: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with wall cutouts on same sides', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes + cutouts on all four walls', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        back: ENABLED_SIDE,
        left: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with sharp corners (radius=0)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        cornerRadius: 0,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with max corner radius (oval)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        cornerRadius: 10,
        height: 20,
        width: 60,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes + wide cutout suppresses all segments', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 90, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes + left-aligned cutout (asymmetric split)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: {
          ...DISABLED_WALL_CUTOUT,
          enabled: true,
          width: 30,
          depth: 50,
          alignment: 'left',
          offset: 0,
          widthMm: null,
        },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        width: 90,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  // --- New shape scenarios ---
  defineScenario('handles', 'oval shape handles on front wall', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        shape: 'oval',
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'scoop shape handles on front wall', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        shape: 'scoop',
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'u-shape handles auto-anchored to floor', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        shape: 'u-shape',
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'multi-handle count=2 on wide bin', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        count: 2,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'custom vertical position at 40%', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        verticalPosition: 0.4,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'interior wall handles with 2x2 compartments', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        interior: true,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'chamfer enabled on rectangle handles', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        chamfer: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),
];
