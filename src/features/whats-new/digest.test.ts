import { describe, expect, it } from 'vitest';
import { DIGEST_LIMIT, buildDigest, groupByMonth, resolveText } from './digest';
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

describe('buildDigest', () => {
  it('returns everything newer than the marker as unseen', () => {
    const d = buildDigest(ENTRIES, 'c');
    expect(d.kind).toBe('unseen');
    expect(d.entries.map((e) => e.id)).toEqual(['f', 'e', 'd']);
  });

  it('reports recent, not unseen, when the user is caught up', () => {
    // Otherwise the modal claims "N updates since you were last here" to
    // someone who has missed nothing.
    const d = buildDigest(ENTRIES, 'f');
    expect(d.kind).toBe('recent');
    expect(d.entries).toHaveLength(DIGEST_LIMIT);
  });

  it('reports recent when the marker was pruned', () => {
    const d = buildDigest(ENTRIES, 'long-gone');
    expect(d.kind).toBe('recent');
    expect(d.entries).toHaveLength(DIGEST_LIMIT);
  });

  it('reports recent for an empty marker rather than replaying everything', () => {
    const d = buildDigest(ENTRIES, '');
    expect(d.kind).toBe('recent');
    expect(d.entries).toHaveLength(DIGEST_LIMIT);
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
