import { describe, it, expect } from 'vitest';
import { formatHeightUnits, isStandardStackHeight } from './heightUnits';

describe('formatHeightUnits', () => {
  it('renders whole units without decimals', () => {
    expect(formatHeightUnits(5)).toBe('5');
  });

  it('renders fractional units up to two decimals, trailing zeros stripped', () => {
    expect(formatHeightUnits(4.37)).toBe('4.37');
    expect(formatHeightUnits(2.5)).toBe('2.5');
    expect(formatHeightUnits(4.3700001)).toBe('4.37');
  });
});

describe('isStandardStackHeight', () => {
  it('is true for integer heights at the standard 7mm unit', () => {
    expect(isStandardStackHeight(5, 7)).toBe(true);
    expect(isStandardStackHeight(10, 7)).toBe(true);
  });

  it('is true for a custom unit that still lands on a 7mm multiple', () => {
    expect(isStandardStackHeight(2, 3.5)).toBe(true); // 7mm
    expect(isStandardStackHeight(4, 3.5)).toBe(true); // 14mm
  });

  it('is false for a custom unit that breaks the 7mm grid', () => {
    expect(isStandardStackHeight(5, 3.8)).toBe(false); // 19mm
  });

  it('is false for a fractional height that breaks the 7mm grid', () => {
    expect(isStandardStackHeight(4.37, 7)).toBe(false); // 30.59mm
  });
});
