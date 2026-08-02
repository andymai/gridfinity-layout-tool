import { create } from 'zustand';

/**
 * Composition seam for the since-last-visit community digest, mirroring
 * communityDetail: the community feature computes the digest from the
 * owner's mine list and publishes it here, so the community entry points in
 * other trees (bin-designer's Design Showcase button, the shell gallery tab
 * bar) can render the unseen-deltas dot without a cross-feature import.
 */

export interface CommunityDigestSummary {
  readonly likesDelta: number;
  readonly remixesDelta: number;
  readonly exportsDelta: number;
  readonly hasDelta: boolean;
}

interface CommunityDigestState {
  summary: CommunityDigestSummary | null;
  /** Drives the entry-point dot; cleared when Mine is actually viewed. */
  hasUnseenDeltas: boolean;
}

interface CommunityDigestActions {
  setDigest: (summary: CommunityDigestSummary) => void;
  /**
   * Clears the dot but keeps the summary, so the Mine delta line stays
   * readable for the visit that just consumed it.
   */
  markSeen: () => void;
  reset: () => void;
}

export type CommunityDigestStore = CommunityDigestState & CommunityDigestActions;

export const INITIAL_COMMUNITY_DIGEST_STATE: CommunityDigestState = {
  summary: null,
  hasUnseenDeltas: false,
};

export const useCommunityDigestStore = create<CommunityDigestStore>((set) => ({
  ...INITIAL_COMMUNITY_DIGEST_STATE,
  setDigest: (summary) => {
    set({ summary, hasUnseenDeltas: summary.hasDelta });
  },
  markSeen: () => {
    set({ hasUnseenDeltas: false });
  },
  reset: () => {
    set(INITIAL_COMMUNITY_DIGEST_STATE);
  },
}));
