import { describe, expect, it } from 'vitest';
import { dayKey, monthOf } from './yearDates';

describe('monthOf', () => {
  it('reads Unix ms and ISO strings in local time', () => {
    const march = new Date(2026, 2, 31, 23, 30);
    expect(monthOf(march.getTime())).toBe(2);
    expect(monthOf(march.toISOString())).toBe(2);
  });
});

describe('dayKey', () => {
  it('gives two times on one local day the same key', () => {
    expect(dayKey(new Date(2026, 4, 9, 0, 5).getTime())).toBe(
      dayKey(new Date(2026, 4, 9, 23, 55).toISOString())
    );
  });

  it('gives different days different keys', () => {
    expect(dayKey(new Date(2026, 4, 9).getTime())).not.toBe(
      dayKey(new Date(2026, 4, 10).getTime())
    );
  });
});
