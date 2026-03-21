import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
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
        front: { enabled: true, width: 70, depth: 50 },
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
