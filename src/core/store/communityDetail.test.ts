import { describe, it, expect, beforeEach } from 'vitest';
import type { CommunityCard } from '@/shared/types/community';
import { INITIAL_COMMUNITY_DETAIL_STATE, useCommunityDetailStore } from './communityDetail';

const card: CommunityCard = {
  id: 'Abc123456789',
  name: 'Screw Bin',
  authorName: 'Andy',
  authorPublicId: 'a'.repeat(32),
  category: 'hardware',
  techniques: ['compartments'],
  metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
  thumbnailUrl: 'https://blob.example/thumb.webp',
  isRemix: false,
  featured: false,
  counts: { likes: 3, remixes: 1, exports: 2 },
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  status: 'live',
};

describe('communityDetail store', () => {
  beforeEach(() => {
    useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
  });

  it('starts closed', () => {
    expect(useCommunityDetailStore.getState().request).toBeNull();
  });

  it('opens with a card snapshot', () => {
    useCommunityDetailStore.getState().open(card.id, card);
    expect(useCommunityDetailStore.getState().request).toEqual({ designId: card.id, card });
  });

  it('opens by bare id with a null card', () => {
    useCommunityDetailStore.getState().open('Xyz987654321');
    expect(useCommunityDetailStore.getState().request).toEqual({
      designId: 'Xyz987654321',
      card: null,
    });
  });

  it('close clears the request', () => {
    useCommunityDetailStore.getState().open(card.id, card);
    useCommunityDetailStore.getState().close();
    expect(useCommunityDetailStore.getState().request).toBeNull();
  });

  it('syncLike lands only on the open design', () => {
    useCommunityDetailStore.getState().open(card.id, card);
    useCommunityDetailStore
      .getState()
      .syncLike({ designId: 'Other1234567', likes: 9, likedByMe: true });
    expect(useCommunityDetailStore.getState().likeSync).toBeNull();
    useCommunityDetailStore.getState().syncLike({ designId: card.id, likes: 4, likedByMe: true });
    expect(useCommunityDetailStore.getState().likeSync).toEqual({
      designId: card.id,
      likes: 4,
      likedByMe: true,
    });
  });

  it('syncLike is dropped when no detail is open', () => {
    useCommunityDetailStore.getState().syncLike({ designId: card.id, likes: 4, likedByMe: true });
    expect(useCommunityDetailStore.getState().likeSync).toBeNull();
  });

  it('clearLikeSync consumes the record and open/close reset it', () => {
    useCommunityDetailStore.getState().open(card.id, card);
    useCommunityDetailStore.getState().syncLike({ designId: card.id, likes: 4, likedByMe: true });
    useCommunityDetailStore.getState().clearLikeSync();
    expect(useCommunityDetailStore.getState().likeSync).toBeNull();

    useCommunityDetailStore.getState().syncLike({ designId: card.id, likes: 5, likedByMe: true });
    useCommunityDetailStore.getState().open('Xyz987654321');
    expect(useCommunityDetailStore.getState().likeSync).toBeNull();

    useCommunityDetailStore
      .getState()
      .syncLike({ designId: 'Xyz987654321', likes: 1, likedByMe: true });
    useCommunityDetailStore.getState().close();
    expect(useCommunityDetailStore.getState().likeSync).toBeNull();
  });
});
