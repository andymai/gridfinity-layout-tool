import { describe, it, expect } from 'vitest';
import { computePinPositions } from './splitUtils';

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
