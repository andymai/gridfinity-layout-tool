import { describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_COMMUNITY_DIGEST_STATE, useCommunityDigestStore } from './communityDigest';
import type { CommunityDigestSummary } from './communityDigest';

const withDeltas: CommunityDigestSummary = {
  likesDelta: 4,
  remixesDelta: 2,
  exportsDelta: 8,
  hasDelta: true,
};

const noDeltas: CommunityDigestSummary = {
  likesDelta: 0,
  remixesDelta: 0,
  exportsDelta: 0,
  hasDelta: false,
};

beforeEach(() => {
  useCommunityDigestStore.setState(INITIAL_COMMUNITY_DIGEST_STATE);
});

describe('useCommunityDigestStore', () => {
  it('starts with no summary and no dot', () => {
    expect(useCommunityDigestStore.getState().summary).toBeNull();
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(false);
  });

  it('setDigest lights the dot only when there is a delta', () => {
    useCommunityDigestStore.getState().setDigest(withDeltas);
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(true);

    useCommunityDigestStore.getState().setDigest(noDeltas);
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(false);
    expect(useCommunityDigestStore.getState().summary).toEqual(noDeltas);
  });

  it('markSeen clears the dot but keeps the summary readable', () => {
    useCommunityDigestStore.getState().setDigest(withDeltas);
    useCommunityDigestStore.getState().markSeen();
    expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(false);
    expect(useCommunityDigestStore.getState().summary).toEqual(withDeltas);
  });

  it('reset returns to the initial state', () => {
    useCommunityDigestStore.getState().setDigest(withDeltas);
    useCommunityDigestStore.getState().reset();
    expect(useCommunityDigestStore.getState()).toMatchObject(INITIAL_COMMUNITY_DIGEST_STATE);
  });
});
