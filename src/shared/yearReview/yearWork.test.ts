import { describe, expect, it } from 'vitest';
import { designCountsForYear, inYear, layoutCountsForYear, yearBounds } from './yearWork';

const bounds = yearBounds(2026);
const at = (year: number, month: number, day: number, hour = 12): number =>
  new Date(year, month, day, hour).getTime();
const iso = (year: number, month: number, day: number): string =>
  new Date(at(year, month, day)).toISOString();

describe('inYear', () => {
  it('uses local time at both ends', () => {
    expect(inYear(at(2025, 11, 31, 23), bounds)).toBe(false);
    expect(inYear(at(2026, 0, 1, 0), bounds)).toBe(true);
    expect(inYear(at(2026, 11, 31, 23), bounds)).toBe(true);
    expect(inYear(at(2027, 0, 1, 0), bounds)).toBe(false);
  });

  it('rejects a date it cannot read', () => {
    expect(inYear('not a date', bounds)).toBe(false);
  });
});

describe('layoutCountsForYear', () => {
  it('counts a drawer started in the year that holds a bin', () => {
    expect(layoutCountsForYear({ createdAt: at(2026, 4, 1), gridBinCount: 1 }, bounds)).toBe(true);
  });

  it('leaves out an empty drawer and one started the year before', () => {
    expect(layoutCountsForYear({ createdAt: at(2026, 4, 1), gridBinCount: 0 }, bounds)).toBe(false);
    expect(layoutCountsForYear({ createdAt: at(2025, 4, 1), gridBinCount: 9 }, bounds)).toBe(false);
  });
});

describe('designCountsForYear', () => {
  const design = { createdAt: iso(2025, 3, 1), versionDates: [], untouched: false };

  it('counts a design made in the year', () => {
    expect(designCountsForYear({ ...design, createdAt: iso(2026, 3, 1) }, bounds)).toBe(true);
  });

  it('counts an older design with a version saved in the year', () => {
    expect(designCountsForYear({ ...design, versionDates: [iso(2026, 5, 2)] }, bounds)).toBe(true);
  });

  it('leaves out an older design with no version in the year', () => {
    expect(designCountsForYear(design, bounds)).toBe(false);
  });

  it('leaves out the untouched default design', () => {
    expect(
      designCountsForYear({ ...design, createdAt: iso(2026, 3, 1), untouched: true }, bounds)
    ).toBe(false);
  });
});
