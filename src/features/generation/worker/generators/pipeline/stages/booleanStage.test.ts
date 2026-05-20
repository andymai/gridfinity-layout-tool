import { beforeEach, describe, it, expect } from 'vitest';
import {
  type BooleanFallbackRecord,
  categorizeError,
  getBooleanFallbackStats,
  resetBooleanFallbackStats,
} from './booleanStage';

describe('categorizeError', () => {
  it('returns the raw message for short OCCT-style errors', () => {
    expect(categorizeError(new Error('BRepAlgoAPI failed'))).toBe('BRepAlgoAPI failed');
  });

  it('replaces digit runs with # so identifier-bearing messages collapse to one bucket', () => {
    expect(
      categorizeError(new Error('Standard_ConstructionError: face 42 incompatible with face 17'))
    ).toBe('Standard_ConstructionError: face # incompatible with face #');
  });

  it('collapses runs of whitespace so wrapped or tabbed messages stay stable', () => {
    expect(categorizeError(new Error('a\n\tb   c'))).toBe('a b c');
  });

  it('truncates to 120 chars so a single mega-error cannot expand cardinality', () => {
    const long = 'x'.repeat(500);
    expect(categorizeError(new Error(long))).toHaveLength(120);
  });

  it('stringifies non-Error throwables for tolerance', () => {
    expect(categorizeError('plain string error')).toBe('plain string error');
    expect(categorizeError(42)).toBe('#');
  });
});

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
      targetCount: 1,
      successfulCount: 0,
      errorCategory: 'mutation attempt',
    });
    expect(getBooleanFallbackStats()).toEqual([]);
  });
});
