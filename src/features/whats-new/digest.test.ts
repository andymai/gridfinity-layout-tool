import { describe, expect, it } from 'vitest';
import {
  DIGEST_LIMIT,
  DIGEST_MAX,
  buildDigest,
  countByKind,
  groupByKind,
  groupByMonth,
  resolveText,
  splitLead,
} from './digest';
import type { WhatsNewEntry, WhatsNewKind } from './types';

function entry(id: string, date: string, kind?: WhatsNewKind): WhatsNewEntry {
  return { id, date, title: { en: id }, ...(kind ? { kind } : {}) };
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

  it('caps a long unseen list but still reports its true size', () => {
    // An unbounded unseen list auto-opens a modal holding weeks of entries.
    const many = Array.from({ length: 20 }, (_, i) => entry(`e${i}`, '2026-08-24'));
    many.push(entry('marker', '2026-07-01'));
    const d = buildDigest(many, 'marker');
    expect(d.entries).toHaveLength(DIGEST_MAX);
    expect(d.total).toBe(20);
  });

  it('reports the full catalogue size when falling back to recent', () => {
    expect(buildDigest(ENTRIES, '').total).toBe(ENTRIES.length);
  });
});

describe('splitLead', () => {
  it('promotes the newest featured entry and leaves the rest in order', () => {
    const entries = [
      entry('f', '2026-08-24'),
      { ...entry('e', '2026-08-20'), featured: true },
      entry('d', '2026-08-02'),
      { ...entry('c', '2026-07-30'), featured: true },
    ];
    const { headline, rest } = splitLead(entries);
    expect(headline?.id).toBe('e');
    expect(rest.map((r) => r.id)).toEqual(['f', 'd', 'c']);
  });

  it('leads with nothing when no entry in range is featured', () => {
    const { headline, rest } = splitLead(ENTRIES);
    expect(headline).toBeNull();
    expect(rest).toEqual(ENTRIES);
  });
});

describe('groupByKind', () => {
  it('orders sections new, improved, fixed regardless of entry order', () => {
    const entries = [
      entry('a', '2026-08-24', 'fixed'),
      entry('b', '2026-08-23', 'improved'),
      entry('c', '2026-08-22', 'new'),
    ];
    expect(groupByKind(entries).map((g) => g.kind)).toEqual(['new', 'improved', 'fixed']);
  });

  it('drops empty sections', () => {
    expect(groupByKind([entry('a', '2026-08-24', 'fixed')]).map((g) => g.kind)).toEqual(['fixed']);
  });

  it("treats a missing kind as 'new', matching the row default", () => {
    expect(groupByKind([entry('a', '2026-08-24')])[0].kind).toBe('new');
  });
});

describe('countByKind', () => {
  it('counts entries whose kind is implicit as new', () => {
    const entries = [entry('a', '2026-08-24'), entry('b', '2026-08-23', 'fixed')];
    expect(countByKind(entries, 'new')).toBe(1);
    expect(countByKind(entries, 'fixed')).toBe(1);
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
