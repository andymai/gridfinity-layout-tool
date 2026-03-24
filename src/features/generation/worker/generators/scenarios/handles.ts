import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const handles: ScenarioCase[] = [
  defineScenario('handles', 'standard bin with front + side handles', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { enabled: true },
        left: { enabled: true },
        right: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handles with label tabs (back suppression)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        back: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handles with wall cutouts on same sides', {
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
        front: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handles + cutouts on all four walls', {
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
        front: { enabled: true },
        back: { enabled: true },
        left: { enabled: true },
        right: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handles + left-aligned cutout (asymmetric split)', {
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
        front: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handles + wide cutout suppresses all segments', {
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
        front: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
];
