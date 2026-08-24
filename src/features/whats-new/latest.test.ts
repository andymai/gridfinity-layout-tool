import { describe, expect, it } from 'vitest';
import { WHATS_NEW_ENTRIES } from './entries';
import { LATEST_ENTRY_ID } from './latest';

describe('LATEST_ENTRY_ID', () => {
  it('matches the newest entry', () => {
    expect(LATEST_ENTRY_ID).toBe(WHATS_NEW_ENTRIES[0].id);
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
