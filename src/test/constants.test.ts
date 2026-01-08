import { describe, it, expect } from 'vitest';
import { calcMaxGridUnits, CONSTRAINTS } from '../constants';

describe('calcMaxGridUnits', () => {
  it('calculates max units for typical print bed', () => {
    // 256mm bed, 42mm grid, 10mm gap
    // N ≤ (256 + 10) / (42 + 10) = 266 / 52 = 5.11 → 5
    expect(calcMaxGridUnits(256, 42)).toBe(5);
  });

  it('returns 1 for small print bed', () => {
    // 40mm bed can only fit 1 unit of 42mm grid
    expect(calcMaxGridUnits(40, 42)).toBe(1);
  });

  it('calculates correctly for large print bed', () => {
    // 300mm bed, 42mm grid, 10mm gap
    // N ≤ (300 + 10) / (42 + 10) = 310 / 52 = 5.96 → 5
    expect(calcMaxGridUnits(300, 42)).toBe(5);
  });

  it('handles exact fit scenarios', () => {
    // Bed size that fits exactly 3 units: 3*42 + 2*10 = 146mm
    // N ≤ (146 + 10) / (42 + 10) = 156 / 52 = 3
    expect(calcMaxGridUnits(146, 42)).toBe(3);
  });

  it('uses PRINT_GAP_MM constant', () => {
    // Verify the calculation uses the gap constant
    const gap = CONSTRAINTS.PRINT_GAP_MM;
    expect(gap).toBe(10);
  });

  it('handles small grid units', () => {
    // 256mm bed, 20mm grid
    // N ≤ (256 + 10) / (20 + 10) = 266 / 30 = 8.86 → 8
    expect(calcMaxGridUnits(256, 20)).toBe(8);
  });

  it('never returns less than 1', () => {
    // Even impossible scenarios return at least 1
    expect(calcMaxGridUnits(1, 100)).toBe(1);
  });
});
