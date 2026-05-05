import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const integration: ScenarioCase[] = [
  defineScenario('integration', 'generates a 1x1 bin without lip', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
  defineScenario('integration', 'generates a 1x1 bin with lip', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', 'generates a 2x2 bin (DEFAULT_BIN_PARAMS)', {
    assert: 'structural',
    params: {},
    timeout: 60_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1.5x2 bin with segmented sockets (full + half cells)', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
    timeout: 60_000,
  }),
  defineScenario('integration', '0.5x0.5 bin with single half-cell socket', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
  defineScenario('integration', '1.5x1.5 bin with lip', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 60_000,
  }),
  defineScenario('integration', '0.5x1 bin with half-width socket cell', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
  defineScenario('integration', '1.5x2 bin with magnets only in full cells', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
    },
    timeout: 60_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1x1x3 bin with honeycomb walls (export mode)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    forExport: true,
    timeout: 120_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1x1x3 bin with honeycomb walls (preview mode)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    timeout: 120_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1x1x3 bin WITHOUT honeycomb walls', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      wallPattern: { enabled: false, pattern: 'honeycomb' },
    },
    timeout: 60_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
];
