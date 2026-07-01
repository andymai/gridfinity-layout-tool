import { describe, it, expect } from 'vitest';
import {
  formatHeightUnits,
  isStandardStackHeight,
  STACK_LIP_MM,
  stackPitchMm,
  stackedTotalMm,
  solveHeightUnitMm,
} from './heightUnits';

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

describe('stackPitchMm', () => {
  it('is the body height (units × unitMm), independent of the lip', () => {
    expect(stackPitchMm(3, 7)).toBe(21);
    expect(stackPitchMm(2, 9.362)).toBeCloseTo(18.724, 5);
  });
});

describe('stackedTotalMm', () => {
  it('a single bin equals body + one lip (its printed height)', () => {
    expect(stackedTotalMm(3, 7, 1)).toBeCloseTo(21 + STACK_LIP_MM, 5);
  });

  it('nests: two H bins equal one 2H bin (divisibility law)', () => {
    expect(stackedTotalMm(5, 7, 2)).toBeCloseTo(stackedTotalMm(10, 7, 1), 5);
  });

  it('each added bin advances by the pitch, not the printed height', () => {
    const one = stackedTotalMm(2, 9.362, 1);
    const two = stackedTotalMm(2, 9.362, 2);
    expect(two - one).toBeCloseTo(stackPitchMm(2, 9.362), 5);
  });

  it('is zero for a non-positive count', () => {
    expect(stackedTotalMm(3, 7, 0)).toBe(0);
  });
});

describe('solveHeightUnitMm', () => {
  it('inverts stackedTotalMm', () => {
    const u = solveHeightUnitMm(stackedTotalMm(2, 8.5, 4), 2, 4);
    expect(u).toBeCloseTo(8.5, 5);
  });

  it('accounts for the single top lip, not one lip per bin', () => {
    // 4 bins × 2u into a 75.6mm space → (75.6 − 4.3) / 8 = 8.9125mm/unit
    expect(solveHeightUnitMm(75.6, 2, 4)).toBeCloseTo((75.6 - STACK_LIP_MM) / 8, 5);
  });

  it('returns null when the target is below the lip or inputs are degenerate', () => {
    expect(solveHeightUnitMm(STACK_LIP_MM, 2, 4)).toBeNull();
    expect(solveHeightUnitMm(75.6, 0, 4)).toBeNull();
    expect(solveHeightUnitMm(75.6, 2, 0)).toBeNull();
  });
});
