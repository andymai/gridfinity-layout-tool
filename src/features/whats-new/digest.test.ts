import { describe, expect, it } from 'vitest';
import { DIGEST_LIMIT, getUnseenEntries, groupByMonth, resolveText } from './digest';
import type { WhatsNewEntry } from './types';

function entry(id: string, date: string): WhatsNewEntry {
  return { id, date, title: { en: id } };
}

const ENTRIES: WhatsNewEntry[] = [
  entry('f', '2026-08-24'),
  entry('e', '2026-08-20'),
  entry('d', '2026-08-02'),
  entry('c', '2026-07-30'),
  entry('b', '2026-07-01'),
  entry('a', '2026-06-15'),
];

describe('getUnseenEntries', () => {
  it('returns nothing when the newest entry is the marker', () => {
    expect(getUnseenEntries(ENTRIES, 'f')).toEqual([]);
  });

  it('returns everything newer than the marker', () => {
    expect(getUnseenEntries(ENTRIES, 'c').map((e) => e.id)).toEqual(['f', 'e', 'd']);
  });

  it('falls back to the newest few when the marker was pruned', () => {
    expect(getUnseenEntries(ENTRIES, 'long-gone')).toHaveLength(DIGEST_LIMIT);
  });

  it('treats an empty marker as pruned rather than replaying everything', () => {
    expect(getUnseenEntries(ENTRIES, '')).toHaveLength(DIGEST_LIMIT);
  });
});

describe('groupByMonth', () => {
  it('groups consecutive entries and keeps their order', () => {
    expect(groupByMonth(ENTRIES).map((g) => [g.month, g.entries.map((e) => e.id)])).toEqual([
      ['2026-08', ['f', 'e', 'd']],
      ['2026-07', ['c', 'b']],
      ['2026-06', ['a']],
    ]);
  });

  it('handles an empty list', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('resolveText', () => {
  it('prefers the requested locale', () => {
    expect(resolveText({ en: 'Hello', de: 'Hallo' }, 'de')).toBe('Hallo');
  });

  it('falls back to English for an untranslated locale', () => {
    expect(resolveText({ en: 'Hello' }, 'ja')).toBe('Hello');
  });
});
