import { create } from 'zustand';
import type { CommunityCard } from '@/shared/types/community';

/**
 * Composition seam for the community detail view, mirroring communityPublish:
 * the community gallery (features/community) opens a design here and the
 * shell-mounted detail overlay reads it, so neither the shell nor another
 * feature needs a cross-feature import to show a design's detail page.
 */

export interface CommunityDetailRequest {
  readonly designId: string;
  /**
   * Card snapshot from the browse index, when the detail was opened from a
   * card: provides the poster, name, and read-only counts without waiting for
   * the record fetch. Null when opened by bare id.
   */
  readonly card: CommunityCard | null;
}

/**
 * Server-resolved like state pushed by the post-OAuth resume
 * (useCommunityLikeReturn). The open detail's own fetch can race the resumed
 * like write and snapshot likedByMe=false; the detail consumes this record
 * after its fetch settles so the heart cannot contradict the "Design liked."
 * toast.
 */
export interface CommunityDetailLikeSync {
  readonly designId: string;
  readonly likes: number;
  readonly likedByMe: boolean;
}

interface CommunityDetailState {
  request: CommunityDetailRequest | null;
  likeSync: CommunityDetailLikeSync | null;
}

interface CommunityDetailActions {
  open: (designId: string, card?: CommunityCard) => void;
  close: () => void;
  /** No-op unless the sync targets the currently open design, so a resolved like can never linger and replay onto a later detail view. */
  syncLike: (sync: CommunityDetailLikeSync) => void;
  clearLikeSync: () => void;
}

export type CommunityDetailStore = CommunityDetailState & CommunityDetailActions;

export const INITIAL_COMMUNITY_DETAIL_STATE: CommunityDetailState = {
  request: null,
  likeSync: null,
};

export const useCommunityDetailStore = create<CommunityDetailStore>((set) => ({
  ...INITIAL_COMMUNITY_DETAIL_STATE,
  open: (designId, card) => {
    set({ request: { designId, card: card ?? null }, likeSync: null });
  },
  close: () => {
    set({ request: null, likeSync: null });
  },
  syncLike: (sync) => {
    set((state) => (state.request?.designId === sync.designId ? { likeSync: sync } : {}));
  },
  clearLikeSync: () => {
    set({ likeSync: null });
  },
}));
