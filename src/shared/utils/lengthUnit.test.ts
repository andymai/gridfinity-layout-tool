import { describe, expect, it } from 'vitest';
import { formatLength, fromMm, isLengthUnit, toMm } from './lengthUnit';
import { formatMm } from './format';

describe('lengthUnit', () => {
  it('converts centimeters and inches to millimeters and back', () => {
    expect(toMm(43, 'cm')).toBe(430);
    expect(toMm(17, 'in')).toBeCloseTo(431.8, 10);
    expect(fromMm(430, 'cm')).toBe(43);
    expect(fromMm(25.4, 'in')).toBe(1);
    expect(toMm(441, 'mm')).toBe(441);
  });

  it('formats millimeters exactly as formatMm does', () => {
    for (const mm of [441, 441.25, 83.5, 0.004, 1176]) {
      expect(formatLength(mm, 'mm')).toBe(formatMm(mm));
    }
  });

  it('formats centimeters and inches with no trailing zeros', () => {
    expect(formatLength(430, 'cm')).toBe('43');
    expect(formatLength(83.5, 'cm')).toBe('8.35');
    expect(formatLength(431.8, 'in')).toBe('17');
    expect(formatLength(42, 'in')).toBe('1.654');
    expect(formatLength(42, 'in', 2)).toBe('1.65');
  });

  it('recognises only the three units', () => {
    expect(isLengthUnit('cm')).toBe(true);
    expect(isLengthUnit('ft')).toBe(false);
    expect(isLengthUnit(undefined)).toBe(false);
  });
});
