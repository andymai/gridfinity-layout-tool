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

interface CommunityDetailState {
  request: CommunityDetailRequest | null;
}

interface CommunityDetailActions {
  open: (designId: string, card?: CommunityCard) => void;
  close: () => void;
}

export type CommunityDetailStore = CommunityDetailState & CommunityDetailActions;

export const INITIAL_COMMUNITY_DETAIL_STATE: CommunityDetailState = {
  request: null,
};

export const useCommunityDetailStore = create<CommunityDetailStore>((set) => ({
  ...INITIAL_COMMUNITY_DETAIL_STATE,
  open: (designId, card) => {
    set({ request: { designId, card: card ?? null } });
  },
  close: () => {
    set({ request: null });
  },
}));
