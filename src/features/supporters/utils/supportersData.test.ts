import { describe, it, expect } from 'vitest';
import {
  FALLBACK_SUPPORTERS,
  buildSupporterBins,
  getSupporterCount,
  isSupportersData,
  type SupportersData,
} from './supportersData';
import supportersData from '../data/supporters.json';

const LIVE: SupportersData = { named: ['Ada', 'Grace'], anonymousCount: 3 };

describe('supportersData', () => {
  it('counts named + anonymous supporters', () => {
    expect(getSupporterCount()).toBe(supportersData.named.length + supportersData.anonymousCount);
  });

  it('builds one bin per supporter', () => {
    const bins = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0);
    expect(bins).toHaveLength(getSupporterCount());
  });

  it('renders anonymous supporters as null-named bins', () => {
    const bins = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0);
    expect(bins.filter((b) => b.name === null)).toHaveLength(supportersData.anonymousCount);
    expect(bins.filter((b) => b.name !== null)).toHaveLength(supportersData.named.length);
  });

  it('never emits an email address as a name', () => {
    const bins = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0);
    for (const bin of bins) {
      expect(bin.name ?? '').not.toContain('@');
    }
  });

  it('shuffles deterministically for a given RNG', () => {
    const a = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0.5).map((b) => b.id);
    const b = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0.5).map((b) => b.id);
    expect(a).toEqual(b);
  });

  it('assigns unique ids', () => {
    const bins = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0);
    expect(new Set(bins.map((b) => b.id)).size).toBe(bins.length);
  });

  describe('with live data', () => {
    it('counts the fetched list, not the bundled one', () => {
      expect(getSupporterCount(LIVE)).toBe(5);
    });

    it('builds bins from the fetched list', () => {
      const bins = buildSupporterBins(LIVE, () => 0);
      expect(bins).toHaveLength(5);
      expect(bins.filter((b) => b.name === null)).toHaveLength(3);
      expect(
        bins
          .map((b) => b.name)
          .filter(Boolean)
          .sort()
      ).toEqual(['Ada', 'Grace']);
    });

    it('handles an empty list without throwing', () => {
      expect(buildSupporterBins({ named: [], anonymousCount: 0 }, () => 0)).toEqual([]);
      expect(getSupporterCount({ named: [], anonymousCount: 0 })).toBe(0);
    });
  });
});

describe('isSupportersData', () => {
  it('accepts a well-formed payload', () => {
    expect(isSupportersData({ named: ['Ada'], anonymousCount: 2 })).toBe(true);
  });

  it('accepts an empty payload', () => {
    expect(isSupportersData({ named: [], anonymousCount: 0 })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['a missing named array', { anonymousCount: 1 }],
    ['a non-array named', { named: 'Ada', anonymousCount: 1 }],
    ['non-string names', { named: [1, 2], anonymousCount: 0 }],
    ['a missing count', { named: [] }],
    ['a non-numeric count', { named: [], anonymousCount: '3' }],
    ['a negative count', { named: [], anonymousCount: -1 }],
    ['a NaN count', { named: [], anonymousCount: Number.NaN }],
  ])('rejects %s', (_label, value) => {
    expect(isSupportersData(value)).toBe(false);
  });
});
