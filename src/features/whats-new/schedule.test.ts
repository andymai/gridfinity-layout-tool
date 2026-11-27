import { describe, expect, it } from 'vitest';
import { isShown, localDay, msUntilNextDay, shownEntries } from './schedule';

describe('localDay', () => {
  it('reads the local calendar day, not the UTC one', () => {
    expect(localDay(new Date(2026, 11, 1, 0, 5))).toBe('2026-12-01');
    expect(localDay(new Date(2026, 10, 30, 23, 59))).toBe('2026-11-30');
  });
});

describe('isShown', () => {
  it('shows an entry with no start date', () => {
    expect(isShown(undefined, '2020-01-01')).toBe(true);
  });

  it('hides an entry until its start date, then shows it', () => {
    expect(isShown('2026-12-01', '2026-11-30')).toBe(false);
    expect(isShown('2026-12-01', '2026-12-01')).toBe(true);
    expect(isShown('2026-12-01', '2027-01-15')).toBe(true);
  });
});

describe('shownEntries', () => {
  it('keeps the order and drops entries whose date has not come', () => {
    const entries = [{ id: 'later', showFrom: '2026-12-01' }, { id: 'now' }, { id: 'old' }];
    expect(shownEntries(entries, '2026-11-30').map((entry) => entry.id)).toEqual(['now', 'old']);
    expect(shownEntries(entries, '2026-12-01').map((entry) => entry.id)).toEqual([
      'later',
      'now',
      'old',
    ]);
  });
});

describe('msUntilNextDay', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 10, 30, 23, 59, 0))).toBe(60_000);
  });
});
