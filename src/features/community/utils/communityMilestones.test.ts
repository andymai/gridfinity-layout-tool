// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CommunityDigest, DigestCounts } from './communityDigest';
import {
  HUNDRED_PRINTS_THRESHOLD,
  TEN_REMIXES_THRESHOLD,
  claimMilestone,
  dueAggregateMilestones,
  hasFiredMilestone,
} from './communityMilestones';

const KEY = 'gridfinity-community-milestones-v1';
const USER = 'user-a';

function counts(likes: number, remixes: number, exports: number): DigestCounts {
  return { likes, remixes, exports };
}

function digest(overrides: Partial<CommunityDigest> = {}): CommunityDigest {
  return { likesDelta: 0, remixesDelta: 0, exportsDelta: 0, hasDelta: false, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('claimMilestone', () => {
  it('fires exactly once per kind per user', () => {
    expect(claimMilestone(USER, 'first_publish')).toBe(true);
    expect(claimMilestone(USER, 'first_publish')).toBe(false);
    expect(claimMilestone(USER, 'first_publish')).toBe(false);
  });

  it('tracks kinds independently', () => {
    expect(claimMilestone(USER, 'first_publish')).toBe(true);
    expect(claimMilestone(USER, 'hundred_prints')).toBe(true);
    expect(hasFiredMilestone(USER, 'first_publish')).toBe(true);
    expect(hasFiredMilestone(USER, 'ten_published_remixes')).toBe(false);
  });

  it('tracks users independently', () => {
    expect(claimMilestone(USER, 'first_publish')).toBe(true);
    expect(claimMilestone('user-b', 'first_publish')).toBe(true);
    expect(claimMilestone('user-b', 'first_publish')).toBe(false);
  });

  it('recovers from corrupted storage and still claims once', () => {
    localStorage.setItem(KEY, 'not json');
    expect(claimMilestone(USER, 'first_publish')).toBe(true);
    expect(claimMilestone(USER, 'first_publish')).toBe(false);
  });

  it('refuses the claim when the record cannot be persisted', () => {
    // A claim that does not persist would re-celebrate on every visit.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(claimMilestone(USER, 'first_publish')).toBe(false);
  });
});

describe('dueAggregateMilestones', () => {
  it('returns nothing below every threshold with no remix delta', () => {
    expect(dueAggregateMilestones({ a: counts(50, 9, 99) }, digest())).toEqual([]);
  });

  it('flags the first remix from a positive remix delta, not from totals', () => {
    expect(
      dueAggregateMilestones({ a: counts(0, 1, 0) }, digest({ remixesDelta: 1, hasDelta: true }))
    ).toEqual(['first_remix_of_yours']);
    // A fresh browser seeing pre-existing remixes has no delta: stale news.
    expect(dueAggregateMilestones({ a: counts(0, 3, 0) }, digest())).toEqual([]);
  });

  it('does not call a new remix on an established design the first', () => {
    // Fresh device (no claim record) for a design already at 50 remixes: the
    // delta only accounts for remix #51, which is nobody's first.
    expect(
      dueAggregateMilestones({ a: counts(0, 51, 0) }, digest({ remixesDelta: 1, hasDelta: true }))
    ).not.toContain('first_remix_of_yours');
  });

  it('flags ten published remixes summed across designs', () => {
    expect(
      dueAggregateMilestones(
        { a: counts(0, 6, 0), b: counts(0, TEN_REMIXES_THRESHOLD - 6, 0) },
        digest()
      )
    ).toEqual(['ten_published_remixes']);
  });

  it('flags a hundred prints summed across designs', () => {
    expect(
      dueAggregateMilestones(
        { a: counts(0, 0, 60), b: counts(0, 0, HUNDRED_PRINTS_THRESHOLD - 60) },
        digest()
      )
    ).toEqual(['hundred_prints']);
  });

  it('can flag several milestones in one pass', () => {
    // All 12 remixes arrived unseen (delta equals the total), so the first
    // remix, the ten-remix threshold, and the print threshold are all news.
    expect(
      dueAggregateMilestones(
        { a: counts(0, 12, 150) },
        digest({ remixesDelta: 12, hasDelta: true })
      )
    ).toEqual(['first_remix_of_yours', 'ten_published_remixes', 'hundred_prints']);
  });
});
