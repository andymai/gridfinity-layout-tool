import { describe, it, expect } from 'vitest';
import { estimateBinGeneration, recordCompletedGeneration } from './estimateBin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { PerfSnapshot } from '../../bridge/types';

function snapshot(stages: Record<string, number>): PerfSnapshot {
  return {
    totalMs: Object.values(stages).reduce((a, b) => a + b, 0),
    stages: Object.entries(stages).map(([name, ms]) => ({ name, ms })),
    featureBuilders: [],
    wallPatternSubsteps: [],
    hexCenterCount: 0,
    patternCutToolCount: 0,
  };
}

describe('estimateBinGeneration', () => {
  it('returns null before any generation has been observed', () => {
    expect(estimateBinGeneration(DEFAULT_BIN_PARAMS)).toBeNull();
  });

  it('sums observed stage costs for a cold (all-miss) generation', () => {
    recordCompletedGeneration(snapshot({ base: 600, features: 100, boolean: 200, merge: 100 }));
    // Empty caches → shell + features both miss → full predicted cost.
    expect(estimateBinGeneration(DEFAULT_BIN_PARAMS)).toBe(1000);
  });

  it('ignores stage-less snapshots (baseplate path) instead of wiping history', () => {
    recordCompletedGeneration(snapshot({}));
    expect(estimateBinGeneration(DEFAULT_BIN_PARAMS)).toBe(1000);
  });

  it('counts the features stage as a miss when the wall pattern is enabled', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    };
    // Conservative: pattern caches aren't probed, so cost stays the full sum.
    expect(estimateBinGeneration(params)).toBe(1000);
  });
});
