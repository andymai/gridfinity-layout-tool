import { describe, it, expect } from 'vitest';
import {
  mm,
  gridUnits,
  heightUnits,
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
    it('converts millimeters to height units (floors)', () => {
      expect(mmToHeightUnits(mm(7), heightUnitMm)).toBe(1);
      expect(mmToHeightUnits(mm(21), heightUnitMm)).toBe(3);
    });

    it('floors partial height units', () => {
      expect(mmToHeightUnits(mm(10), heightUnitMm)).toBe(1);
    });

    it('handles zero', () => {
      expect(mmToHeightUnits(mm(0), heightUnitMm)).toBe(0);
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
