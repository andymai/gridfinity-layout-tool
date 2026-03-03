import { describe, it, expect } from 'vitest';
import { getSplitPositions, getSplitPieceCount, getSplitPlanePositionsMm } from './splitPositions';
import { computePinPositions } from '@/shared/generation/splitUtils';

describe('getSplitPositions', () => {
  it('returns empty for bin that fits', () => {
    expect(getSplitPositions(4, 6)).toEqual([]);
  });

  it('returns empty for bin exactly at max', () => {
    expect(getSplitPositions(6, 6)).toEqual([]);
  });

  it('splits a 7-wide bin at ceil(7/2) = 4', () => {
    const positions = getSplitPositions(7, 6);
    expect(positions).toEqual([4]);
  });

  it('splits a 13-wide bin recursively', () => {
    // 13 -> split at 7: [7, 6]
    // 7 -> split at 4: [4, 3]
    // So splits at positions 7, 4
    const positions = getSplitPositions(13, 6);
    expect(positions).toContain(7);
    expect(positions).toContain(4);
    expect(positions).toHaveLength(2);
  });

  it('handles single unit over max', () => {
    const positions = getSplitPositions(7, 6);
    expect(positions).toHaveLength(1);
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
    // 13-wide: splits at 7 and 4 -> 3 columns
    // 3-deep: fits -> 1 row
    expect(getSplitPieceCount(13, 3, 6)).toBe(3);
  });
});

describe('getSplitPlanePositionsMm', () => {
  const GRID_SIZE = 42;

  it('returns empty for bin that fits', () => {
    expect(getSplitPlanePositionsMm(4, 6, GRID_SIZE)).toEqual([]);
  });

  it('returns correct mm position for a 7-wide bin', () => {
    // 7 units wide = 294mm total. Center at 0.
    // Split at grid position 4 -> 4*42 - 294/2 = 168 - 147 = 21mm from center
    const positions = getSplitPlanePositionsMm(7, 6, GRID_SIZE);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toBe(21);
  });

  it('returns sorted positions for multi-split', () => {
    const positions = getSplitPlanePositionsMm(13, 6, GRID_SIZE);
    expect(positions.length).toBeGreaterThan(1);
    // Verify sorted ascending
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});

describe('computePinPositions', () => {
  it('returns at least 2 pins for any valid edge', () => {
    const positions = computePinPositions(20, 35);
    expect(positions.length).toBeGreaterThanOrEqual(2);
  });

  it('returns positions centered around zero', () => {
    const positions = computePinPositions(100, 35);
    // 100mm / 35mm ≈ 3 pins
    expect(positions).toHaveLength(3);
    // Sum of centered positions should be ~0
    const sum = positions.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0, 5);
  });

  it('returns 2 pins for short edge', () => {
    const positions = computePinPositions(30, 35);
    expect(positions).toHaveLength(2);
  });

  it('distributes pins evenly', () => {
    const positions = computePinPositions(120, 35);
    // 120/35 ≈ 3.4 → rounds to 3 pins
    expect(positions).toHaveLength(3);
    // Check even spacing
    const spacing = positions[1] - positions[0];
    expect(positions[2] - positions[1]).toBeCloseTo(spacing, 5);
  });

  it('returns empty for zero or negative edge', () => {
    expect(computePinPositions(0, 35)).toEqual([]);
    expect(computePinPositions(-10, 35)).toEqual([]);
  });

  it('returns empty for zero spacing', () => {
    expect(computePinPositions(100, 0)).toEqual([]);
  });

  it('scales pin count with edge length', () => {
    const short = computePinPositions(50, 35);
    const long = computePinPositions(200, 35);
    expect(long.length).toBeGreaterThan(short.length);
  });
});
