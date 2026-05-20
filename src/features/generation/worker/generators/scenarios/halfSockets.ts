import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const existing = [
  { w: 1, d: 1, label: '1×1' },
  { w: 1.5, d: 1.5, label: '1.5×1.5' },
  { w: 2, d: 2, label: '2×2' },
];

export const halfSockets: ScenarioCase[] = [
  ...existing.map(({ w, d, label }) =>
    defineScenario('half-sockets', `${label} with half sockets`, {
      params: {
        width: w,
        depth: d,
        base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      },
    })
  ),

  defineScenario('half-sockets', '0.5×1 half-bin with half sockets', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '0.5x1-halfSockets');
      assertNoDegenerateTriangles(result, '0.5x1-halfSockets');
    },
  }),

  defineScenario('half-sockets', '2.5×2.5 fractional + half sockets', {
    assert: 'structural',
    params: {
      width: 2.5,
      depth: 2.5,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  }),

  defineScenario('half-sockets', '3×3 with half sockets (stress)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
    timeout: 60_000,
  }),

  defineScenario('half-sockets', '2×2 half sockets + screw base', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, style: 'screw' },
    },
  }),

  defineScenario('half-sockets', '2×2 half sockets + magnet+screw base', {
    assert: 'structural',
    params: {
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        halfSockets: true,
        style: 'magnet_and_screw',
      },
    },
  }),

  defineScenario('half-sockets', '2×2 half sockets + tall (12u)', {
    assert: 'structural',
    params: {
      height: 12,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  }),

  defineScenario('half-sockets', '2×2 half sockets + weighted base', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, style: 'weighted' },
    },
  }),

  defineScenario('half-sockets', '1×1 half sockets + no lip + tall (10u)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 10,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        halfSockets: true,
        stackingLip: false,
      },
    },
  }),
];
