import { describe, it, expect } from 'vitest';
import { matchRecords, type SearchableRecord } from './matcher';

const rec = (id: string, label: string, keywords: string[] = []): SearchableRecord<null> => ({
  id,
  label,
  keywords,
  meta: null,
});

const orderedIds = (q: string, records: SearchableRecord<null>[]) =>
  matchRecords(q, records).map((r) => r.id);

describe('matchRecords', () => {
  it('returns nothing for an empty query', () => {
    expect(matchRecords('  ', [rec('a', 'Anything')])).toEqual([]);
  });

  it('ranks exact > prefix > word-prefix > substring', () => {
    const records = [
      rec('substr', 'Solidly'), // "lid" sits mid-word, not at a boundary
      rec('word', 'Big lid'),
      rec('prefix', 'Lid grip'),
      rec('exact', 'Lid'),
    ];
    expect(orderedIds('lid', records)).toEqual(['exact', 'prefix', 'word', 'substr']);
  });

  it('highlights the matched label span, once', () => {
    const [hit] = matchRecords('rip', [rec('a', 'Lid grip')]);
    expect(hit.highlight).toEqual([[5, 8]]);
  });

  it('matches via a synonym but ranks it below a label hit, with no highlight', () => {
    const records = [rec('label', 'Magnet holes'), rec('syn', 'Base', ['magnet'])];
    const results = matchRecords('magnet', records);
    expect(results.map((r) => r.id)).toEqual(['label', 'syn']);
    expect(results[1].highlight).toEqual([]);
  });

  it('tolerates a gapped subsequence but ranks it last', () => {
    const records = [rec('sub', 'Lightweight floor'), rec('exact', 'LWT')];
    const results = matchRecords('lwt', records);
    // "LWT" is an exact hit; "Lightweight floor" only a subsequence.
    expect(results[0].id).toBe('exact');
    expect(results.map((r) => r.id)).toContain('sub');
  });
});
