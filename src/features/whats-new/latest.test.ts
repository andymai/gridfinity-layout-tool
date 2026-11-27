import { describe, expect, it } from 'vitest';
import { WHATS_NEW_ENTRIES } from './entries';
import { LATEST_ENTRIES, isCaughtUp, latestEntryId } from './latest';

describe('LATEST_ENTRIES', () => {
  it('matches the newest entries, down to the newest one with no start date', () => {
    const end = WHATS_NEW_ENTRIES.findIndex((entry) => entry.showFrom === undefined);
    const head = WHATS_NEW_ENTRIES.slice(0, end + 1).map(({ id, showFrom }) =>
      showFrom === undefined ? { id } : { id, showFrom }
    );
    expect(LATEST_ENTRIES).toEqual(head);
  });
});

describe('latestEntryId', () => {
  const [newest] = LATEST_ENTRIES;
  const scheduled = newest?.showFrom;

  it.runIf(scheduled !== undefined)('skips a scheduled entry until its day', () => {
    if (scheduled === undefined) return;
    const unscheduled = LATEST_ENTRIES.find((entry) => entry.showFrom === undefined);
    expect(latestEntryId('2000-01-01')).toBe(unscheduled?.id);
    expect(latestEntryId(scheduled)).toBe(newest?.id);
  });
});

describe('isCaughtUp', () => {
  it('reads a marker on a scheduled entry, left by a clock set ahead, as caught up', () => {
    const [newest] = LATEST_ENTRIES;
    expect(isCaughtUp(newest?.id ?? '', '2000-01-01')).toBe(true);
  });

  it('reads an older marker as behind', () => {
    expect(isCaughtUp(WHATS_NEW_ENTRIES.at(-1)?.id ?? '', '2000-01-01')).toBe(false);
  });
});

describe('WHATS_NEW_ENTRIES', () => {
  it('has unique ids', () => {
    const ids = WHATS_NEW_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is ordered newest first', () => {
    const dates = WHATS_NEW_ENTRIES.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('uses ISO dates', () => {
    for (const entry of WHATS_NEW_ENTRIES) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('always has English copy', () => {
    for (const entry of WHATS_NEW_ENTRIES) {
      expect(entry.title.en.length).toBeGreaterThan(0);
      if (entry.body) expect(entry.body.en.length).toBeGreaterThan(0);
    }
  });

  it('avoids em dashes in user-facing copy', () => {
    for (const entry of WHATS_NEW_ENTRIES) {
      expect(entry.title.en).not.toContain('—');
      expect(entry.body?.en ?? '').not.toContain('—');
    }
  });
});
