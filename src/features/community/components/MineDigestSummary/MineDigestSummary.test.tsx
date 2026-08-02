// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  INITIAL_COMMUNITY_DIGEST_STATE,
  useCommunityDigestStore,
} from '@/core/store/communityDigest';
import type { CommunityDigestSummary } from '@/core/store/communityDigest';
import { useSessionStore } from '@/core/sync/session/useSession';
import { INITIAL_MINE_STATE, useMineStore } from '../../store/mineStore';
import {
  commitDigestSeen,
  computeDigest,
  loadUserDigestRecord,
  saveFetchedCounts,
} from '../../utils/communityDigest';
import { MineDigestSummary } from './MineDigestSummary';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string | number>) =>
    vars === undefined
      ? key
      : `${key}(${Object.entries(vars)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(',')})`,
}));

const USER = 'user-a';

function summary(overrides: Partial<CommunityDigestSummary>): CommunityDigestSummary {
  return { likesDelta: 0, remixesDelta: 0, exportsDelta: 0, hasDelta: true, ...overrides };
}

function signIn(userId: string): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId, provider: 'github', email: 'a@example.com' },
  });
}

beforeEach(() => {
  localStorage.clear();
  useCommunityDigestStore.setState(INITIAL_COMMUNITY_DIGEST_STATE);
  useMineStore.setState({ ...INITIAL_MINE_STATE });
  useSessionStore.setState({ status: 'anonymous', user: null });
});

describe('MineDigestSummary', () => {
  it('renders nothing when signed out even with a digest present', () => {
    useCommunityDigestStore.getState().setDigest(summary({ likesDelta: 4 }));
    render(<MineDigestSummary />);
    expect(screen.queryByTestId('community-mine-digest')).not.toBeInTheDocument();
  });

  it('renders nothing without deltas', () => {
    signIn(USER);
    useCommunityDigestStore.getState().setDigest(summary({ hasDelta: false }));
    render(<MineDigestSummary />);
    expect(screen.queryByTestId('community-mine-digest')).not.toBeInTheDocument();
  });

  it('joins only the non-zero delta clauses', () => {
    signIn(USER);
    useCommunityDigestStore.getState().setDigest(summary({ likesDelta: 4, remixesDelta: 1 }));
    render(<MineDigestSummary />);
    const text = screen.getByTestId('community-mine-digest').textContent ?? '';
    expect(text).toContain('community.mine.digest.summary');
    expect(text).toContain('community.mine.digest.likes(count=4)');
    expect(text).toContain('community.mine.digest.remixesOne');
    expect(text).not.toContain('prints');
  });

  it('uses the singular clause only for exactly one', () => {
    signIn(USER);
    useCommunityDigestStore.getState().setDigest(summary({ exportsDelta: 2 }));
    render(<MineDigestSummary />);
    const text = screen.getByTestId('community-mine-digest').textContent ?? '';
    expect(text).toContain('community.mine.digest.prints(count=2)');
    expect(text).not.toContain('printsOne');
  });

  it('viewing commits the seen baseline and clears the dot, but keeps the line up', () => {
    signIn(USER);
    saveFetchedCounts(USER, { a: { likes: 1, remixes: 0, exports: 0 } }, 0);
    commitDigestSeen(USER);
    saveFetchedCounts(USER, { a: { likes: 5, remixes: 0, exports: 0 } }, 1000);
    useCommunityDigestStore.getState().setDigest(computeDigest(loadUserDigestRecord(USER)));
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(true);

    render(<MineDigestSummary />);

    expect(screen.getByTestId('community-mine-digest')).toBeInTheDocument();
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(false);
    // Snapshot committed: the next digest computation is quiet.
    expect(computeDigest(loadUserDigestRecord(USER)).hasDelta).toBe(false);
    // The summary itself survives for this visit.
    expect(useCommunityDigestStore.getState().summary?.likesDelta).toBe(4);
  });

  it('re-commits when a fresh mine fetch lands while the view is open', () => {
    signIn(USER);
    saveFetchedCounts(USER, { a: { likes: 1, remixes: 0, exports: 0 } }, 0);
    commitDigestSeen(USER);
    saveFetchedCounts(USER, { a: { likes: 5, remixes: 0, exports: 0 } }, 1000);
    useCommunityDigestStore.getState().setDigest(computeDigest(loadUserDigestRecord(USER)));
    render(<MineDigestSummary />);
    expect(computeDigest(loadUserDigestRecord(USER)).hasDelta).toBe(false);

    // A mineStore refetch writes newer latest counts and bumps fetchedAt;
    // the displayed counts must land in the seen baseline too.
    saveFetchedCounts(USER, { a: { likes: 9, remixes: 0, exports: 0 } }, 2000);
    act(() => {
      useMineStore.setState({ fetchedAt: 2000 });
    });
    expect(computeDigest(loadUserDigestRecord(USER)).hasDelta).toBe(false);
  });

  it('does not commit the snapshot when there is no digest yet', () => {
    signIn(USER);
    saveFetchedCounts(USER, { a: { likes: 5, remixes: 0, exports: 0 } }, 1000);
    render(<MineDigestSummary />);
    expect(loadUserDigestRecord(USER).seen).toEqual({});
  });
});
