import { beforeEach, describe, it, expect } from 'vitest';
import {
  type BooleanFallbackRecord,
  getBooleanFallbackStats,
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
