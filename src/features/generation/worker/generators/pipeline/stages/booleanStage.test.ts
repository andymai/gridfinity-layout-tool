import { beforeEach, describe, it, expect } from 'vitest';
import {
  type BooleanFallbackRecord,
  getBooleanFallbackStats,
  recordIfRecovered,
  resetBooleanFallbackStats,
} from './booleanStage';

describe('boolean fallback stats', () => {
  beforeEach(() => {
    resetBooleanFallbackStats();
  });

  it('starts empty and resets to empty', () => {
    expect(getBooleanFallbackStats()).toEqual([]);
    resetBooleanFallbackStats();
    expect(getBooleanFallbackStats()).toEqual([]);
  });

  it('returns a defensive copy so callers cannot mutate the internal accumulator', () => {
    const snapshot = getBooleanFallbackStats() as BooleanFallbackRecord[];
    snapshot.push({
      category: 'cut',
      totalInputs: 1,
      batchAttempts: 1,
      batchSucceeded: 0,
      singletonFallbacks: 0,
      failedInputCount: 1,
    });
    expect(getBooleanFallbackStats()).toEqual([]);
  });
});

describe('recordIfRecovered', () => {
  beforeEach(() => {
    resetBooleanFallbackStats();
  });

  it('records nothing when the first-try n-way batch succeeded', () => {
    recordIfRecovered('cut', {
      totalInputs: 5,
      batchAttempts: 1,
      batchSucceeded: 1,
      singletonFallbacks: 0,
      failedInputs: [],
    });
    expect(getBooleanFallbackStats()).toEqual([]);
  });

  it('records when bisect recursed (batchAttempts > 1)', () => {
    recordIfRecovered('fuse', {
      totalInputs: 8,
      batchAttempts: 3,
      batchSucceeded: 2,
      singletonFallbacks: 1,
      failedInputs: [4],
    });
    expect(getBooleanFallbackStats()).toEqual([
      {
        category: 'fuse',
        totalInputs: 8,
        batchAttempts: 3,
        batchSucceeded: 2,
        singletonFallbacks: 1,
        failedInputCount: 1,
      },
    ]);
  });

  it('records when bisect bottomed out at pair ops (singletonFallbacks > 0) even with batchAttempts === 1', () => {
    recordIfRecovered('pattern_cut', {
      totalInputs: 2,
      batchAttempts: 1,
      batchSucceeded: 0,
      singletonFallbacks: 2,
      failedInputs: [],
    });
    expect(getBooleanFallbackStats()).toHaveLength(1);
  });

  it('maps failedInputCount from failedInputs.length so the array stays out of telemetry', () => {
    recordIfRecovered('cut', {
      totalInputs: 10,
      batchAttempts: 5,
      batchSucceeded: 3,
      singletonFallbacks: 2,
      failedInputs: [1, 4, 7],
    });
    const [record] = getBooleanFallbackStats();
    expect(record?.failedInputCount).toBe(3);
  });
});
