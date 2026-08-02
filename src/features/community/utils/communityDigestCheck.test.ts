// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '@/core/result';
import {
  INITIAL_COMMUNITY_DIGEST_STATE,
  useCommunityDigestStore,
} from '@/core/store/communityDigest';
import type { CommunityCard } from '@/shared/types/community';
import {
  DIGEST_CHECK_FLOOR_MS,
  commitDigestSeen,
  loadUserDigestRecord,
  saveFetchedCounts,
} from './communityDigest';
import { claimMilestone } from './communityMilestones';
import { resetCommunityDigestCheckForTests, runCommunityDigestCheck } from './communityDigestCheck';
import { fetchMineIndex } from '../api/client';

vi.mock('../api/client', () => ({
  fetchMineIndex: vi.fn(),
}));

const fetchMineIndexMock = vi.mocked(fetchMineIndex);

const USER = 'user-a';

function card(id: string, likes: number, remixes: number, exports: number): CommunityCard {
  return {
    id,
    counts: { likes, remixes, exports },
  } as unknown as CommunityCard;
}

function mineResult(cards: CommunityCard[]) {
  return ok({ items: cards, capped: false });
}

beforeEach(() => {
  localStorage.clear();
  resetCommunityDigestCheckForTests();
  useCommunityDigestStore.setState(INITIAL_COMMUNITY_DIGEST_STATE);
  fetchMineIndexMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('runCommunityDigestCheck', () => {
  it('fetches when due, stores the counts, and publishes the digest to the seam store', async () => {
    saveFetchedCounts(USER, { a: { likes: 1, remixes: 0, exports: 0 } }, 0);
    commitDigestSeen(USER);
    fetchMineIndexMock.mockResolvedValue(mineResult([card('a', 4, 1, 2)]));

    await runCommunityDigestCheck(USER);

    expect(fetchMineIndexMock).toHaveBeenCalledTimes(1);
    const stored = loadUserDigestRecord(USER);
    expect(stored.latest).toEqual({ a: { likes: 4, remixes: 1, exports: 2 } });
    expect(stored.lastCheckedAt).toBeGreaterThan(0);
    expect(useCommunityDigestStore.getState().summary).toEqual({
      likesDelta: 3,
      remixesDelta: 1,
      exportsDelta: 2,
      hasDelta: true,
    });
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(true);
  });

  it('skips the fetch within the 30-minute floor but still recomputes stored deltas', async () => {
    saveFetchedCounts(USER, { a: { likes: 1, remixes: 0, exports: 0 } }, 0);
    commitDigestSeen(USER);
    // A fetch from another app open a minute ago, deltas not yet seen.
    saveFetchedCounts(USER, { a: { likes: 5, remixes: 0, exports: 0 } }, Date.now() - 60_000);

    await runCommunityDigestCheck(USER);

    expect(fetchMineIndexMock).not.toHaveBeenCalled();
    expect(useCommunityDigestStore.getState().summary).toMatchObject({
      likesDelta: 4,
      hasDelta: true,
    });
  });

  it('fetches again once the floor has elapsed', async () => {
    saveFetchedCounts(
      USER,
      { a: { likes: 1, remixes: 0, exports: 0 } },
      Date.now() - DIGEST_CHECK_FLOOR_MS
    );
    fetchMineIndexMock.mockResolvedValue(mineResult([card('a', 1, 0, 0)]));

    await runCommunityDigestCheck(USER);

    expect(fetchMineIndexMock).toHaveBeenCalledTimes(1);
  });

  it('runs at most once per session per user, sharing one promise', async () => {
    fetchMineIndexMock.mockResolvedValue(mineResult([card('a', 1, 0, 0)]));

    const first = runCommunityDigestCheck(USER);
    const second = runCommunityDigestCheck(USER);
    expect(second).toBe(first);
    await Promise.all([first, second]);

    await runCommunityDigestCheck(USER);
    expect(fetchMineIndexMock).toHaveBeenCalledTimes(1);
  });

  it('checks separately per user', async () => {
    fetchMineIndexMock.mockResolvedValue(mineResult([]));
    await runCommunityDigestCheck(USER);
    await runCommunityDigestCheck('user-b');
    expect(fetchMineIndexMock).toHaveBeenCalledTimes(2);
  });

  it('keeps lastCheckedAt on a failed fetch so the next app open retries', async () => {
    fetchMineIndexMock.mockResolvedValue(err({ kind: 'network' as const }));

    await runCommunityDigestCheck(USER);

    expect(loadUserDigestRecord(USER).lastCheckedAt).toBe(0);
    expect(useCommunityDigestStore.getState().summary).toMatchObject({ hasDelta: false });
  });

  it('returns due milestones not yet fired and filters already-claimed ones', async () => {
    saveFetchedCounts(USER, { a: { likes: 0, remixes: 2, exports: 0 } }, 0);
    commitDigestSeen(USER);
    fetchMineIndexMock.mockResolvedValue(mineResult([card('a', 0, 12, 150)]));
    claimMilestone(USER, 'hundred_prints');

    const due = await runCommunityDigestCheck(USER);

    // No first_remix_of_yours: the seen baseline already held 2 remixes, so
    // this delta is not anyone's first.
    expect(due).toEqual(['ten_published_remixes']);
  });

  it('reports no milestones for a user with no published designs', async () => {
    fetchMineIndexMock.mockResolvedValue(mineResult([]));
    const due = await runCommunityDigestCheck(USER);
    expect(due).toEqual([]);
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(false);
  });
});
