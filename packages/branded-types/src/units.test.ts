import { describe, it, expect } from 'vitest';
import {
  mm,
  gridUnits,
  heightUnits,
  roundHeightUnits,
  gridUnitsToMm,
  heightUnitsToMm,
  mmToGridUnits,
  mmToHeightUnits,
} from './units';
import type { Mm, GridUnits, HeightUnits } from './units';

describe('Unit constructors', () => {
  it('brands numbers without changing value', () => {
    expect(mm(42)).toBe(42);
    expect(gridUnits(6)).toBe(6);
    expect(heightUnits(3)).toBe(3);
  });

  it('preserves fractional values', () => {
    expect(gridUnits(1.5)).toBe(1.5);
    expect(gridUnits(0.5)).toBe(0.5);
  });

  it('preserves zero', () => {
    expect(mm(0)).toBe(0);
    expect(gridUnits(0)).toBe(0);
    expect(heightUnits(0)).toBe(0);
  });
});

describe('Unit converters', () => {
  const gridUnitMm: Mm = mm(42);
  const heightUnitMm: Mm = mm(7);

  describe('gridUnitsToMm', () => {
    it('converts grid units to millimeters', () => {
      expect(gridUnitsToMm(gridUnits(1), gridUnitMm)).toBe(42);
      expect(gridUnitsToMm(gridUnits(6), gridUnitMm)).toBe(252);
    });

    it('handles fractional grid units (half-bin mode)', () => {
      expect(gridUnitsToMm(gridUnits(1.5), gridUnitMm)).toBe(63);
      expect(gridUnitsToMm(gridUnits(0.5), gridUnitMm)).toBe(21);
    });

    it('handles zero', () => {
      expect(gridUnitsToMm(gridUnits(0), gridUnitMm)).toBe(0);
    });
  });

  describe('heightUnitsToMm', () => {
    it('converts height units to millimeters', () => {
      expect(heightUnitsToMm(heightUnits(1), heightUnitMm)).toBe(7);
      expect(heightUnitsToMm(heightUnits(3), heightUnitMm)).toBe(21);
    });

    it('handles zero', () => {
      expect(heightUnitsToMm(heightUnits(0), heightUnitMm)).toBe(0);
    });
  });

  describe('mmToGridUnits', () => {
    it('converts millimeters to grid units (floors)', () => {
      expect(mmToGridUnits(mm(42), gridUnitMm)).toBe(1);
      expect(mmToGridUnits(mm(252), gridUnitMm)).toBe(6);
    });

    it('floors partial grid units', () => {
      expect(mmToGridUnits(mm(50), gridUnitMm)).toBe(1);
      expect(mmToGridUnits(mm(83), gridUnitMm)).toBe(1);
    });

    it('handles zero', () => {
      expect(mmToGridUnits(mm(0), gridUnitMm)).toBe(0);
    });
  });

  describe('mmToHeightUnits', () => {
    it('converts whole millimeters to height units', () => {
      expect(mmToHeightUnits(mm(7), heightUnitMm)).toBe(1);
      expect(mmToHeightUnits(mm(21), heightUnitMm)).toBe(3);
    });

    it('keeps the fractional part, snapped to 0.0001u', () => {
      expect(mmToHeightUnits(mm(10), heightUnitMm)).toBeCloseTo(1.4286, 6);
      expect(mmToHeightUnits(mm(30.6), heightUnitMm)).toBeCloseTo(4.3714, 6);
    });

    it('handles a custom unit so 2x a 5u target matches a 10u target', () => {
      const customUnit: Mm = mm(3.8);
      const fiveU = mmToHeightUnits(mm(5 * 3.8), customUnit);
      const tenU = mmToHeightUnits(mm(10 * 3.8), customUnit);
      expect(fiveU * 2).toBeCloseTo(tenU, 5);
    });

    it('handles zero', () => {
      expect(mmToHeightUnits(mm(0), heightUnitMm)).toBe(0);
    });

    // The Sidebar and bin inspector show heights with two decimals; a typed mm
    // value must survive the mm -> units -> mm round trip at that precision
    // for every allowed unit size (3-20mm), or the field visibly rewrites the
    // user's number (85 became 84.98 at the default 7mm unit).
    it.each([
      [85, 7],
      [33.33, 7],
      [100.01, 3],
      [85.01, 20],
    ])('round-trips %smm at a %smm unit within display precision', (typed, unit) => {
      const roundTripped = heightUnitsToMm(mmToHeightUnits(mm(typed), mm(unit)), mm(unit));
      expect(Math.round(roundTripped * 100) / 100).toBe(typed);
    });
  });

  describe('roundHeightUnits', () => {
    it('snaps to the nearest 0.0001u', () => {
      expect(roundHeightUnits(4.37000001)).toBeCloseTo(4.37, 6);
      expect(roundHeightUnits(4.37141)).toBeCloseTo(4.3714, 6);
      expect(roundHeightUnits(4.37146)).toBeCloseTo(4.3715, 6);
    });

    it('leaves whole and half units untouched', () => {
      expect(roundHeightUnits(5)).toBe(5);
      expect(roundHeightUnits(2.5)).toBe(2.5);
    });

    it('snaps an exact half-step up despite binary float error (1.00005u -> 1.0001u)', () => {
      // 1.00005 * 10000 === 10000.4999… in IEEE-754, which would otherwise floor to 1.0000.
      expect(roundHeightUnits(1.00005)).toBeCloseTo(1.0001, 6);
    });
  });
});

describe('Type safety (compile-time checks)', () => {
  it('branded types are assignable to number for arithmetic', () => {
    const w: GridUnits = gridUnits(2);
    const h: HeightUnits = heightUnits(3);
    const m: Mm = mm(42);

    // Branded types extend number, so arithmetic works
    expect(w + 1).toBe(3);
    expect(h * 2).toBe(6);
    expect(m / 2).toBe(21);
  });
});
