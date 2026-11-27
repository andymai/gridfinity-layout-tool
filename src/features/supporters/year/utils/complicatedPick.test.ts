import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { YearShortlistEntry, YearStats } from '../types';
import { meshCandidates, pickComplicated } from './complicatedPick';

function entry(id: string, score: number): YearShortlistEntry {
  return { id, name: id, thumbnail: null, params: DEFAULT_BIN_PARAMS, score };
}

const shortlist = [entry('a', 30), entry('b', 20), entry('c', 10)];

describe('pickComplicated', () => {
  it('picks the most triangles among the designs with a mesh', () => {
    const counts: Record<string, number> = { b: 9000, c: 4000 };
    expect(pickComplicated(shortlist, (id) => counts[id])).toEqual({
      design: shortlist[1],
      triangles: 9000,
    });
  });

  it('falls back to the top score, without a count, when no mesh is ready', () => {
    expect(pickComplicated(shortlist, () => undefined)).toEqual({
      design: shortlist[0],
      triangles: null,
    });
  });

  it('has nothing to pick without designs', () => {
    expect(pickComplicated([], () => undefined)).toBeNull();
  });
});

describe('meshCandidates', () => {
  it('puts the longest print first and takes five more by score, once each', () => {
    const many = Array.from({ length: 8 }, (_, i) => entry(`d${i}`, 10 - i));
    const stats = {
      longestPrint: { ...many[2], minutes: 600 },
      complexityShortlist: many,
    } as unknown as YearStats;
    expect(meshCandidates(stats).map((design) => design.id)).toEqual([
      'd2',
      'd0',
      'd1',
      'd3',
      'd4',
    ]);
  });
});
