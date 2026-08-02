// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CommunityCard } from '@/shared/types/community';
import {
  DIGEST_CHECK_FLOOR_MS,
  EMPTY_USER_DIGEST_RECORD,
  commitDigestSeen,
  computeDigest,
  countsFromCards,
  isDigestCheckDue,
  loadUserDigestRecord,
  saveFetchedCounts,
} from './communityDigest';
import type { DigestCounts, UserDigestRecord } from './communityDigest';

const KEY = 'gridfinity-community-digest-v1';
const USER = 'user-a';

function counts(likes: number, remixes: number, exports: number): DigestCounts {
  return { likes, remixes, exports };
}

function record(
  latest: Record<string, DigestCounts>,
  seen: Record<string, DigestCounts>
): UserDigestRecord {
  return { lastCheckedAt: 0, latest, seen };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeDigest', () => {
  it('sums per-design deltas across all three counters', () => {
    const digest = computeDigest(
      record(
        { a: counts(5, 3, 10), b: counts(2, 1, 4) },
        { a: counts(1, 2, 2), b: counts(2, 0, 4) }
      )
    );
    expect(digest).toEqual({ likesDelta: 4, remixesDelta: 2, exportsDelta: 8, hasDelta: true });
  });

  it('reports no delta when counts are unchanged', () => {
    const digest = computeDigest(record({ a: counts(5, 3, 10) }, { a: counts(5, 3, 10) }));
    expect(digest).toEqual({ likesDelta: 0, remixesDelta: 0, exportsDelta: 0, hasDelta: false });
  });

  it('clamps a count correction below the baseline to zero instead of going negative', () => {
    const digest = computeDigest(record({ a: counts(1, 0, 0) }, { a: counts(5, 0, 0) }));
    expect(digest.likesDelta).toBe(0);
    expect(digest.hasDelta).toBe(false);
  });

  it('a design without a seen baseline contributes zero, not its initial counts', () => {
    const digest = computeDigest(record({ fresh: counts(7, 2, 30) }, {}));
    expect(digest).toEqual({ likesDelta: 0, remixesDelta: 0, exportsDelta: 0, hasDelta: false });
  });

  it('mixes baselined and fresh designs correctly', () => {
    const digest = computeDigest(
      record({ a: counts(3, 0, 0), fresh: counts(9, 9, 9) }, { a: counts(1, 0, 0) })
    );
    expect(digest).toEqual({ likesDelta: 2, remixesDelta: 0, exportsDelta: 0, hasDelta: true });
  });
});

describe('snapshot storage', () => {
  it('returns the empty record for an unknown user', () => {
    expect(loadUserDigestRecord(USER)).toEqual(EMPTY_USER_DIGEST_RECORD);
  });

  it('round-trips fetched counts with the check timestamp', () => {
    saveFetchedCounts(USER, { a: counts(1, 2, 3) }, 5000);
    expect(loadUserDigestRecord(USER)).toEqual({
      lastCheckedAt: 5000,
      latest: { a: counts(1, 2, 3) },
      seen: {},
    });
  });

  it('keeps snapshots isolated per user', () => {
    saveFetchedCounts(USER, { a: counts(1, 0, 0) }, 1);
    saveFetchedCounts('user-b', { b: counts(9, 9, 9) }, 2);
    expect(loadUserDigestRecord(USER).latest).toEqual({ a: counts(1, 0, 0) });
    expect(loadUserDigestRecord('user-b').latest).toEqual({ b: counts(9, 9, 9) });
  });

  it('falls back to the empty record on corrupted storage', () => {
    localStorage.setItem(KEY, 'not json');
    expect(loadUserDigestRecord(USER)).toEqual(EMPTY_USER_DIGEST_RECORD);
    localStorage.setItem(KEY, JSON.stringify({ [USER]: { lastCheckedAt: 'nope' } }));
    expect(loadUserDigestRecord(USER)).toEqual(EMPTY_USER_DIGEST_RECORD);
  });

  it('survives a throwing localStorage without crashing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveFetchedCounts(USER, { a: counts(1, 0, 0) }, 1)).not.toThrow();
  });
});

describe('persist-until-seen', () => {
  it('deltas persist across repeated fetches and only reset when Mine is viewed', () => {
    // First-ever fetch: everything is fresh, so no delta; commit seeds the baseline.
    saveFetchedCounts(USER, { a: counts(1, 0, 2) }, 1000);
    expect(computeDigest(loadUserDigestRecord(USER)).hasDelta).toBe(false);
    commitDigestSeen(USER);

    // Counts grow; two consecutive fetches without a Mine view keep the
    // digest relative to the committed baseline, not the previous fetch.
    saveFetchedCounts(USER, { a: counts(3, 1, 2) }, 2000);
    expect(computeDigest(loadUserDigestRecord(USER))).toMatchObject({
      likesDelta: 2,
      remixesDelta: 1,
    });
    saveFetchedCounts(USER, { a: counts(5, 1, 6) }, 3000);
    expect(computeDigest(loadUserDigestRecord(USER))).toMatchObject({
      likesDelta: 4,
      remixesDelta: 1,
      exportsDelta: 4,
      hasDelta: true,
    });

    // Viewing Mine commits latest as the new baseline; the digest goes quiet.
    commitDigestSeen(USER);
    expect(computeDigest(loadUserDigestRecord(USER)).hasDelta).toBe(false);
  });

  it('commitDigestSeen for one user leaves other users unseen', () => {
    saveFetchedCounts(USER, { a: counts(1, 0, 0) }, 1);
    commitDigestSeen(USER);
    saveFetchedCounts(USER, { a: counts(2, 0, 0) }, 2);
    saveFetchedCounts('user-b', { b: counts(1, 0, 0) }, 3);
    commitDigestSeen('user-b');
    expect(computeDigest(loadUserDigestRecord(USER)).likesDelta).toBe(1);
  });
});

describe('isDigestCheckDue', () => {
  it('is due when never checked', () => {
    expect(isDigestCheckDue(EMPTY_USER_DIGEST_RECORD, Date.now())).toBe(true);
  });

  it('is not due within the 30-minute floor', () => {
    const rec: UserDigestRecord = { lastCheckedAt: 100_000, latest: {}, seen: {} };
    expect(isDigestCheckDue(rec, 100_000 + DIGEST_CHECK_FLOOR_MS - 1)).toBe(false);
  });

  it('is due once the floor has elapsed', () => {
    const rec: UserDigestRecord = { lastCheckedAt: 100_000, latest: {}, seen: {} };
    expect(isDigestCheckDue(rec, 100_000 + DIGEST_CHECK_FLOOR_MS)).toBe(true);
  });
});

describe('countsFromCards', () => {
  it('extracts the three digest counters keyed by design id', () => {
    const cards = [
      {
        id: 'a',
        counts: { likes: 1, remixes: 2, exports: 3 },
      },
      {
        id: 'b',
        counts: { likes: 0, remixes: 0, exports: 9 },
      },
    ] as unknown as CommunityCard[];
    expect(countsFromCards(cards)).toEqual({
      a: counts(1, 2, 3),
      b: counts(0, 0, 9),
    });
  });
});
