import { describe, it, expect } from 'vitest';
import { computeMultiHandleOffsets } from './handleLayout';

describe('computeMultiHandleOffsets', () => {
  it('returns single centered handle for count=1', () => {
    const offsets = computeMultiHandleOffsets(1, 100, 50);
    expect(offsets).toHaveLength(1);
    expect(offsets[0]).toBeCloseTo(0, 5);
  });

  it('returns two evenly spaced handles for count=2', () => {
    const offsets = computeMultiHandleOffsets(2, 100, 30);
    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets[1]).toBeGreaterThan(0);
    // Symmetric around center
    expect(offsets[0]).toBeCloseTo(-offsets[1], 5);
  });

  it('returns three evenly spaced handles for count=3', () => {
    const offsets = computeMultiHandleOffsets(3, 120, 20);
    expect(offsets).toHaveLength(3);
    // Middle handle should be centered
    expect(offsets[1]).toBeCloseTo(0, 5);
    // Symmetric
    expect(offsets[0]).toBeCloseTo(-offsets[2], 5);
  });

  it('reduces count when handles cannot fit', () => {
    // 3 handles of 40mm = 120mm + gaps, but wall is only 100mm
    const offsets = computeMultiHandleOffsets(3, 100, 40);
    expect(offsets.length).toBeLessThanOrEqual(3);
    expect(offsets.length).toBeGreaterThan(0);
  });

  it('returns empty array when even one handle cannot fit', () => {
    const offsets = computeMultiHandleOffsets(1, 5, 30);
    expect(offsets).toEqual([]);
  });

  it('handles exact fit with minimum gaps', () => {
    // 1 handle of 94mm + 2 gaps of 3mm = 100mm
    const offsets = computeMultiHandleOffsets(1, 100, 94);
    expect(offsets).toHaveLength(1);
    expect(offsets[0]).toBeCloseTo(0, 5);
  });

  it('clamps count to maximum of 3', () => {
    const offsets = computeMultiHandleOffsets(5, 200, 20);
    expect(offsets.length).toBeLessThanOrEqual(3);
  });
});
