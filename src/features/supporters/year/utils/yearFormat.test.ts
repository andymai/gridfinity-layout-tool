import { describe, expect, it } from 'vitest';
import {
  formatArea,
  formatDuration,
  formatFootprint,
  formatPercent,
  formatSize,
  formatWeight,
  monthName,
  pizzaBoxes,
  printerHours,
  spools,
} from './yearFormat';

describe('yearFormat', () => {
  it('shows area in m² for metric units and ft² for inches', () => {
    expect(formatArea('en', 1_412_000, 'mm')).toBe('1.41 m²');
    expect(formatArea('en', 1_412_000, 'in')).toBe('15.2 ft²');
    expect(formatArea('de', 1_412_000, 'cm')).toBe('1,41 m²');
  });

  it('shows a drawer size in the chosen unit', () => {
    expect(formatSize('en', 612, 455, 'mm')).toBe('612 × 455 mm');
    expect(formatSize('en', 612, 455, 'cm')).toBe('61.2 × 45.5 cm');
    expect(formatSize('en', 609.6, 457.2, 'in')).toBe('24 × 18 in');
  });

  it('writes a half-size footprint with the locale decimal mark', () => {
    expect(formatFootprint('en', 2, 1)).toBe('2×1');
    expect(formatFootprint('de', 0.5, 1)).toBe('0,5×1');
  });

  it('switches from grams to kilograms at one kilogram', () => {
    expect(formatWeight('en', 850)).toBe('850 g');
    expect(formatWeight('en', 2430)).toBe('2.4 kg');
  });

  it('formats a fill ratio as a whole percent', () => {
    expect(formatPercent('en', 0.968)).toBe('97%');
  });

  it('formats a duration in hours and minutes', () => {
    expect(formatDuration('en', 580)).toBe('9 hr 40 min');
    expect(formatDuration('en', 45)).toBe('45 min');
    expect(formatDuration('en', 120)).toBe('2 hr');
  });

  it('names a month on its own', () => {
    expect(monthName('en', 2026, 2)).toBe('March');
    expect(monthName('pl', 2026, 2)).toBe('marzec');
  });

  it('rounds the comparisons and never says zero', () => {
    expect(pizzaBoxes(1_412_000)).toBe(12);
    expect(pizzaBoxes(10)).toBe(1);
    expect(spools(2430)).toBe(2);
    expect(spools(120)).toBe(1);
    expect(printerHours(8580)).toBe(143);
  });
});
