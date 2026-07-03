import { describe, it, expect } from 'vitest';
import { positivePitch } from './footprintGridMath';

describe('positivePitch', () => {
  it('passes through a valid positive pitch', () => {
    expect(positivePitch(22, 42)).toBe(22);
  });

  it('falls back for zero, negative, NaN, Infinity, and undefined', () => {
    // Each of these would make the shader divisor (alignedPos / gridSize)
    // produce divide-by-zero / NaN and corrupt the preview.
    expect(positivePitch(0, 42)).toBe(42);
    expect(positivePitch(-5, 42)).toBe(42);
    expect(positivePitch(Number.NaN, 42)).toBe(42);
    expect(positivePitch(Number.POSITIVE_INFINITY, 42)).toBe(42);
    expect(positivePitch(undefined, 42)).toBe(42);
  });
});
