import { describe, it, expect } from 'vitest';
import {
  FALLBACK_SUPPORTERS,
  buildSupporterBins,
  getSupporterCount,
  isSupportersData,
  joinedThisMonth,
  supportHistogram,
  type SupportersData,
} from './supportersData';
import supportersData from '../data/supporters.json';

const namedCount = supportersData.supporters.filter((s) => s.name).length;
const anonCount = supportersData.supporters.filter((s) => !s.name).length;

const LIVE: SupportersData = {
  supporters: [{ name: 'Ada' }, { name: 'Grace' }, { name: null }, { name: null }, { name: null }],
};

describe('supportersData', () => {
  it('counts every supporter', () => {
    expect(getSupporterCount()).toBe(supportersData.supporters.length);
  });

  it('builds one bin per supporter', () => {
    const bins = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0);
    expect(bins).toHaveLength(getSupporterCount());
  });

  it('renders anonymous supporters as null-named bins', () => {
    const bins = buildSupporterBins(FALLBACK_SUPPORTERS, () => 0);
    expect(bins.filter((b) => b.name === null)).toHaveLength(anonCount);
    expect(bins.filter((b) => b.name !== null)).toHaveLength(namedCount);
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

  describe('newest supporter', () => {
    const dated: SupportersData = {
      supporters: [
        { name: 'Old', joinedAt: '2026-01-01T00:00:00Z' },
        { name: 'New', joinedAt: '2026-07-01T00:00:00Z' },
        { name: 'Middle', joinedAt: '2026-04-01T00:00:00Z' },
      ],
    };

    it('marks exactly the most recent bin as newest', () => {
      const bins = buildSupporterBins(dated, () => 0);
      const newest = bins.filter((b) => b.isNewest);
      expect(newest).toHaveLength(1);
      expect(newest[0].name).toBe('New');
    });

    it('marks none when no supporter carries a date', () => {
      const bins = buildSupporterBins(LIVE, () => 0);
      expect(bins.some((b) => b.isNewest)).toBe(false);
    });

    it('carries joinedAt and message onto bins', () => {
      const bins = buildSupporterBins(
        { supporters: [{ name: 'Ada', joinedAt: '2026-05-01T00:00:00Z', message: 'thanks!' }] },
        () => 0
      );
      expect(bins[0]).toMatchObject({ joinedAt: '2026-05-01T00:00:00Z', message: 'thanks!' });
    });

    it('never carries a message onto an anonymous bin', () => {
      const bins = buildSupporterBins(
        { supporters: [{ name: null, message: 'should not show' }] },
        () => 0
      );
      expect(bins[0].message).toBeUndefined();
    });
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
      expect(buildSupporterBins({ supporters: [] }, () => 0)).toEqual([]);
      expect(getSupporterCount({ supporters: [] })).toBe(0);
    });
  });
});

describe('joinedThisMonth', () => {
  const now = new Date('2026-07-19T12:00:00Z');
  const data: SupportersData = {
    supporters: [
      { name: 'A', joinedAt: '2026-07-02T00:00:00Z' },
      { name: 'B', joinedAt: '2026-07-30T23:00:00Z' },
      { name: 'C', joinedAt: '2026-06-30T00:00:00Z' },
      { name: null, joinedAt: '2026-07-15T00:00:00Z' },
      { name: 'D' },
    ],
  };

  it('counts named and anonymous joins within the calendar month', () => {
    expect(joinedThisMonth(data, now)).toBe(3);
  });

  it('is zero when nobody joined this month', () => {
    expect(joinedThisMonth(data, new Date('2026-09-01T00:00:00Z'))).toBe(0);
  });
});

describe('supportHistogram', () => {
  const now = new Date('2026-07-19T00:00:00Z');
  const data: SupportersData = {
    supporters: [
      { name: 'A', joinedAt: '2026-05-10T00:00:00Z' },
      { name: 'B', joinedAt: '2026-07-01T00:00:00Z' },
      { name: 'C', joinedAt: '2026-07-18T00:00:00Z' },
      { name: 'D' },
    ],
  };

  it('returns a gap-free trailing window, oldest first', () => {
    const buckets = supportHistogram(data, 4, now);
    expect(buckets.map((b) => b.key)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07']);
    expect(buckets.map((b) => b.count)).toEqual([0, 1, 0, 2]);
  });

  it('ignores joins outside the window and undated supporters', () => {
    const buckets = supportHistogram(data, 1, now);
    expect(buckets).toEqual([{ key: '2026-07', count: 2 }]);
  });
});

describe('isSupportersData', () => {
  it('accepts a well-formed payload', () => {
    expect(
      isSupportersData({ supporters: [{ name: 'Ada', joinedAt: '2026-07-01T00:00:00Z' }] })
    ).toBe(true);
  });

  it('accepts anonymous entries and an empty list', () => {
    expect(isSupportersData({ supporters: [{ name: null }] })).toBe(true);
    expect(isSupportersData({ supporters: [] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['a missing supporters array', { count: 1 }],
    ['a non-array supporters', { supporters: 'Ada' }],
    ['a non-object entry', { supporters: [1, 2] }],
    ['a numeric name', { supporters: [{ name: 5 }] }],
    ['a non-string joinedAt', { supporters: [{ name: 'Ada', joinedAt: 5 }] }],
    ['a non-string message', { supporters: [{ name: 'Ada', message: 5 }] }],
    ['a message on an anonymous record', { supporters: [{ name: null, message: 'leak' }] }],
    ['a message on an empty-name record', { supporters: [{ name: '', message: 'leak' }] }],
  ])('rejects %s', (_label, value) => {
    expect(isSupportersData(value)).toBe(false);
  });
});
