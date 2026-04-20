import { describe, it, expect } from 'vitest';
import { getSplitPositions, getSplitPieceCount, getSplitPlanePositionsMm } from './splitPositions';

describe('getSplitPositions', () => {
  it('returns empty for bin that fits', () => {
    expect(getSplitPositions(4, 6)).toEqual([]);
  });

  it('returns empty for bin exactly at max', () => {
    expect(getSplitPositions(6, 6)).toEqual([]);
  });

  it('splits a 7-wide bin into 2 equal pieces', () => {
    // ceil(7/6) = 2 pieces of 3.5 each → split at 3.5
    expect(getSplitPositions(7, 6)).toEqual([3.5]);
  });

  it('splits a 13-wide bin into 3 equal pieces', () => {
    // ceil(13/6) = 3 pieces of 13/3 each
    const positions = getSplitPositions(13, 6);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toBeCloseTo(13 / 3, 10);
    expect(positions[1]).toBeCloseTo((2 * 13) / 3, 10);
  });

  it('honors the offset parameter', () => {
    const positions = getSplitPositions(7, 6, 10);
    expect(positions).toEqual([13.5]);
  });

  it('produces minimum pieces when halving would exceed max (regression for #1400)', () => {
    // 441mm @ 42mm grid = 10.5 grid units; 250mm bed → maxGrid = 5.5
    // Greedy halving produced 3 pieces because ceil(10.5/2)=6 > 5.5.
    // Equal-split produces ceil(10.5/5.5)=2 pieces of 5.25 each.
    const positions = getSplitPositions(10.5, 5.5);
    expect(positions).toEqual([5.25]);
  });
});

describe('getSplitPieceCount', () => {
  it('returns 1 for bin that fits', () => {
    expect(getSplitPieceCount(4, 3, 6)).toBe(1);
  });

  it('returns 2 for width-only oversized', () => {
    expect(getSplitPieceCount(7, 3, 6)).toBe(2);
  });

  it('returns 2 for depth-only oversized', () => {
    expect(getSplitPieceCount(3, 7, 6)).toBe(2);
  });

  it('returns 4 for both dimensions oversized', () => {
    expect(getSplitPieceCount(7, 7, 6)).toBe(4);
  });

  it('returns correct count for large bin needing multiple splits', () => {
    // 13-wide needs ceil(13/6)=3 columns; 3-deep fits → 3 pieces
    expect(getSplitPieceCount(13, 3, 6)).toBe(3);
  });

  it('returns 2 for fractional size just above max (regression for #1400)', () => {
    expect(getSplitPieceCount(10.5, 3, 5.5)).toBe(2);
  });
});

describe('getSplitPlanePositionsMm', () => {
  const GRID_SIZE = 42;

  it('returns empty for bin that fits', () => {
    expect(getSplitPlanePositionsMm(4, 6, GRID_SIZE)).toEqual([]);
  });

  it('returns centered position for a 7-wide bin split in half', () => {
    // 7 units wide = 294mm total. Centered at 0.
    // Equal split at grid 3.5 → 3.5*42 - 147 = 0mm from center
    const positions = getSplitPlanePositionsMm(7, 6, GRID_SIZE);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toBe(0);
  });

  it('returns symmetric positions around center for a 3-way split', () => {
    // 13 units at 42mm = 546mm. Split into 3 pieces → planes at ±546/6 ≈ ±91
    const positions = getSplitPlanePositionsMm(13, 6, GRID_SIZE);
    expect(positions).toHaveLength(2);
    expect(positions[0] + positions[1]).toBeCloseTo(0, 5);
    expect(positions[1] - positions[0]).toBeCloseTo(546 / 3, 5);
  });

  it('returns sorted positions for multi-split', () => {
    const positions = getSplitPlanePositionsMm(13, 6, GRID_SIZE);
    expect(positions.length).toBeGreaterThan(1);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});
