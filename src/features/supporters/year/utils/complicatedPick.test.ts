import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { YearShortlistEntry, YearStats } from '../types';
import { meshCandidates, pickComplicated } from './complicatedPick';

function entry(id: string, score: number): YearShortlistEntry {
  return { id, name: id, thumbnail: null, params: DEFAULT_BIN_PARAMS, score };
}

const shortlist = [entry('a', 30), entry('b', 20), entry('c', 10)];

describe('pickComplicated', () => {
  it('picks the most design work, whatever has the most triangles', () => {
    const counts: Record<string, number> = { a: 3000, b: 90_000 };
    expect(pickComplicated(shortlist, (id) => counts[id])).toEqual({
      design: shortlist[0],
      triangles: 3000,
    });
  });

  it('shows no count until the mesh is ready', () => {
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
  it('asks for the longest print and the most complicated design, once each', () => {
    const many = Array.from({ length: 8 }, (_, i) => entry(`d${i}`, 10 - i));
    const stats = {
      longestPrint: { ...many[2], minutes: 600 },
      complexityShortlist: many,
    } as unknown as YearStats;
    expect(meshCandidates(stats).map((design) => design.id)).toEqual(['d2', 'd0']);
    const same = { ...stats, longestPrint: { ...many[0], minutes: 600 } } as unknown as YearStats;
    expect(meshCandidates(same).map((design) => design.id)).toEqual(['d0']);
  });
});
