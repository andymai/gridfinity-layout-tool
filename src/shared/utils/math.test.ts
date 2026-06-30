import { describe, it, expect } from 'vitest';
import { clamp } from '@/shared/utils/math';

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('clamps to min when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles min === max', () => {
    expect(clamp(3, 5, 5)).toBe(5);
    expect(clamp(7, 5, 5)).toBe(5);
    expect(clamp(5, 5, 5)).toBe(5);
  });

  it('handles negative ranges', () => {
    expect(clamp(-7, -10, -2)).toBe(-7);
    expect(clamp(-15, -10, -2)).toBe(-10);
    expect(clamp(0, -10, -2)).toBe(-2);
  });
});
