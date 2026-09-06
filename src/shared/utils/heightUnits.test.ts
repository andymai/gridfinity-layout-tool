import { describe, it, expect } from 'vitest';
import {
  formatHeightUnits,
  isStandardStackHeight,
  LIP_PROTRUSION_MM,
  STACK_JUNCTION_MM,
  stackPitchMm,
  stackedTotalMm,
  solveUnitsUnderCeiling,
  linkedStackExcessUnits,
} from './heightUnits';

describe('linkedStackExcessUnits', () => {
  const UNIT = 7;
  const standardRise = (h: number) => h * UNIT + LIP_PROTRUSION_MM;

  it('returns 0 with no linked rise data', () => {
    expect(linkedStackExcessUnits(4, UNIT, undefined)).toBe(0);
  });

  it('is exactly neutral for a standard lipped design', () => {
    expect(linkedStackExcessUnits(4, UNIT, { riseMm: standardRise(4) })).toBe(0);
  });

  it('stays neutral for a lipless design (residual under the epsilon)', () => {
    expect(linkedStackExcessUnits(4, UNIT, { riseMm: 4 * UNIT, hasLip: false })).toBe(0);
  });

  it('charges a lid rise above the nominal height', () => {
    const lidMm = 14;
    const excess = linkedStackExcessUnits(4, UNIT, { riseMm: standardRise(4) + lidMm });
    expect(excess).toBeCloseTo(lidMm / UNIT, 6);
  });

  it('charges a design taller than its diverged bin height', () => {
    expect(linkedStackExcessUnits(4, UNIT, { riseMm: standardRise(6) })).toBeCloseTo(2, 6);
  });

  it('never goes negative for a design shorter than the bin', () => {
    expect(linkedStackExcessUnits(6, UNIT, { riseMm: standardRise(4) })).toBe(0);
  });

  it('ignores excess at or under half a millimetre', () => {
    expect(linkedStackExcessUnits(4, UNIT, { riseMm: standardRise(4) + 0.5 })).toBe(0);
    expect(linkedStackExcessUnits(4, UNIT, { riseMm: standardRise(4) + 0.6 })).toBeGreaterThan(0);
  });
});

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
    expect(SHORTFALL_MM).toBeCloseTo(0.35, 5);
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
