import { describe, it, expect } from 'vitest';
import {
  formatHeightUnits,
  isStandardStackHeight,
  LIP_PROTRUSION_MM,
  STACK_JUNCTION_MM,
  stackPitchMm,
  stackedTotalMm,
  solveHeightUnitMm,
  solveUnitsUnderCeiling,
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

/** What each junction costs against the body height: 4.75 − 4.3. */
const SHORTFALL_MM = STACK_JUNCTION_MM - LIP_PROTRUSION_MM;

describe('stackPitchMm', () => {
  it('runs one shortfall under the body height, because the bin settles past the lip', () => {
    expect(stackPitchMm(3, 7)).toBeCloseTo(21 - SHORTFALL_MM, 5);
    expect(stackPitchMm(2, 9.362)).toBeCloseTo(18.724 - SHORTFALL_MM, 5);
  });

  it('the shortfall is the base profile standing proud of the lip', () => {
    expect(SHORTFALL_MM).toBeCloseTo(0.45, 5);
  });
});

describe('stackedTotalMm', () => {
  it('a single bin equals body + one lip (its printed height)', () => {
    expect(stackedTotalMm(3, 7, 1)).toBeCloseTo(21 + LIP_PROTRUSION_MM, 5);
  });

  it('two H bins fall one shortfall short of one 2H bin', () => {
    // Divisibility is near, not exact — #3525. The gap is per junction, so it
    // grows with the stack rather than cancelling.
    expect(stackedTotalMm(5, 7, 2)).toBeCloseTo(stackedTotalMm(10, 7, 1) - SHORTFALL_MM, 5);
    expect(stackedTotalMm(5, 7, 4)).toBeCloseTo(stackedTotalMm(20, 7, 1) - 3 * SHORTFALL_MM, 5);
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

  it('charges one junction for the stack and one shortfall per bin', () => {
    // 4 bins × 2u into 75.6mm: the top junction comes off the target once, then
    // each bin gets its shortfall back because its body outruns its pitch.
    expect(solveHeightUnitMm(75.6, 2, 4)).toBeCloseTo(
      (75.6 - STACK_JUNCTION_MM + 4 * SHORTFALL_MM) / 8,
      5
    );
  });

  it('returns null when the target is below the junction or inputs are degenerate', () => {
    expect(solveHeightUnitMm(STACK_JUNCTION_MM - 4 * SHORTFALL_MM, 2, 4)).toBeNull();
    expect(solveHeightUnitMm(75.6, 0, 4)).toBeNull();
    expect(solveHeightUnitMm(75.6, 2, 0)).toBeNull();
  });
});

describe('solveUnitsUnderCeiling', () => {
  it('never returns a height that overflows the ceiling', () => {
    for (const ceiling of [40, 55, 63.5, 84, 100.2]) {
      for (const count of [1, 2, 3, 4]) {
        const units = solveUnitsUnderCeiling(ceiling, 7, count);
        if (units === null) continue;
        expect(stackedTotalMm(units, 7, count)).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('returns the largest unit that fits, not one below it', () => {
    for (const ceiling of [40, 55, 63.5, 84, 100.2]) {
      for (const count of [1, 2, 3, 4]) {
        const units = solveUnitsUnderCeiling(ceiling, 7, count);
        const next = (units ?? 0) + 1;
        expect(stackedTotalMm(next, 7, count)).toBeGreaterThan(ceiling);
      }
    }
  });

  it('takes the exact fit rather than the unit below it', () => {
    // A ceiling landing exactly on a 4u stack must report 4u, not 3u.
    const exact = stackedTotalMm(4, 7, 2);
    expect(solveUnitsUnderCeiling(exact, 7, 2)).toBe(4);
  });

  it('returns null when even a single unit overflows', () => {
    expect(solveUnitsUnderCeiling(5, 7, 1)).toBeNull();
    expect(solveUnitsUnderCeiling(40, 7, 6)).toBeNull();
  });

  it('rejects degenerate inputs', () => {
    expect(solveUnitsUnderCeiling(100, 7, 0)).toBeNull();
    expect(solveUnitsUnderCeiling(100, 0, 2)).toBeNull();
    expect(solveUnitsUnderCeiling(Number.NaN, 7, 2)).toBeNull();
  });

  it('honours a custom height unit', () => {
    const units = solveUnitsUnderCeiling(55, 4.37, 1);
    expect(units).not.toBeNull();
    expect(stackedTotalMm(units ?? 0, 4.37, 1)).toBeLessThanOrEqual(55);
  });
});
