import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { useLabsStore } from '@/core/store';
import {
  INITIAL_BIN_EXAMPLE_GALLERY_STATE,
  useBinExampleGalleryStore,
} from '@/core/store/binExampleGallery';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import { INITIAL_TOAST_STATE, useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import {
  loadPendingLikeAction,
  savePendingLikeAction,
} from '@/shared/utils/communityPendingLikeAction';
import {
  loadCommunityReopenDesign,
  loadCommunityReturnPath,
  saveCommunityReopenDesign,
  saveCommunityReturnPath,
} from '@/shared/utils/communityReturnPath';
import type { CommunityCard } from '@/shared/types/community';
import { useCommunityLikeReturn } from './useCommunityLikeReturn';

vi.mock('@/features/community/api/client', () => ({
  setDesignLiked: vi.fn(),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { setDesignLiked } from '@/features/community/api/client';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '@/features/community/store/browseStore';
import { trackEvent } from '@/shared/analytics/posthog';

const likeMock = vi.mocked(setDesignLiked);

function card(): CommunityCard {
  return {
    id: 'abc123def456',
    name: 'Screw Sorter',
    authorName: 'Alice',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    counts: { likes: 2, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    likedByMe: false,
  };
}

function enableFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
    },
  }));
}

function authenticate(): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
  });
}

describe('useCommunityLikeReturn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    likeMock.mockReset();
    vi.mocked(trackEvent).mockReset();
    useSessionStore.setState({ status: 'unknown', user: null });
    useToastStore.setState({ ...INITIAL_TOAST_STATE });
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [card()] });
    useBinExampleGalleryStore.setState({ ...INITIAL_BIN_EXAMPLE_GALLERY_STATE });
    useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
    enableFlag(true);
  });

  it('applies the pending like once the session resolves authenticated', async () => {
    likeMock.mockResolvedValue(ok({ likes: 3, likedByMe: true }));
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    authenticate();
    renderHook(() => useCommunityLikeReturn());

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith('abc123def456', true);
    });
    await waitFor(() => {
      const item = useBrowseStore.getState().items[0];
      expect(item.likedByMe).toBe(true);
      expect(item.counts.likes).toBe(3);
    });
    expect(trackEvent).toHaveBeenCalledWith('community_like', { resumed: true });
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      'community.toast.likeSaved'
    );
    // One-shot: the record was consumed.
    expect(loadPendingLikeAction()).toBeNull();
  });

  it('waits while the session is unresolved, then applies on auth', async () => {
    likeMock.mockResolvedValue(ok({ likes: 3, likedByMe: true }));
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    const { rerender } = renderHook(() => useCommunityLikeReturn());
    expect(likeMock).not.toHaveBeenCalled();
    authenticate();
    rerender();
    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith('abc123def456', true);
    });
  });

  it('toasts and drops the record when sign-in was abandoned', async () => {
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    useSessionStore.setState({ status: 'anonymous', user: null });
    renderHook(() => useCommunityLikeReturn());

    await waitFor(() => {
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'community.toast.likeSigninIncomplete'
      );
    });
    expect(likeMock).not.toHaveBeenCalled();
    expect(loadPendingLikeAction()).toBeNull();
  });

  it('toasts an error when the resumed like fails', async () => {
    likeMock.mockResolvedValue(err({ kind: 'server' }));
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    authenticate();
    renderHook(() => useCommunityLikeReturn());

    await waitFor(() => {
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'community.toast.likeFailed'
      );
    });
    expect(useBrowseStore.getState().items[0].likedByMe).toBe(false);
  });

  it('does nothing while the flag is off', () => {
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    saveCommunityReturnPath('/community');
    authenticate();
    enableFlag(false);
    renderHook(() => useCommunityLikeReturn());
    expect(likeMock).not.toHaveBeenCalled();
    expect(loadPendingLikeAction()).not.toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('restores the stashed community origin alongside the resumed like', async () => {
    likeMock.mockResolvedValue(ok({ likes: 3, likedByMe: true }));
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    saveCommunityReturnPath('/community/d/abc123def456');
    authenticate();
    renderHook(() => useCommunityLikeReturn());

    expect(window.location.pathname).toBe('/community/d/abc123def456');
    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith('abc123def456', true);
    });
    // One-shot: the record was consumed.
    expect(loadCommunityReturnPath()).toBeNull();
  });

  it('restores the community origin even when sign-in was abandoned', async () => {
    saveCommunityReturnPath('/community?author=' + 'a'.repeat(32));
    useSessionStore.setState({ status: 'anonymous', user: null });
    renderHook(() => useCommunityLikeReturn());
    expect(window.location.pathname + window.location.search).toBe(
      '/community?author=' + 'a'.repeat(32)
    );
  });

  it('reopens the gallery detail stashed from the tab surface', () => {
    saveCommunityReopenDesign('abc123def456');
    authenticate();
    renderHook(() => useCommunityLikeReturn());

    expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
    expect(useCommunityDetailStore.getState().request?.designId).toBe('abc123def456');
    // One-shot: the record was consumed.
    expect(loadCommunityReopenDesign()).toBeNull();
  });

  it('reopens the detail even when sign-in was abandoned (report can be retried)', () => {
    saveCommunityReopenDesign('abc123def456');
    useSessionStore.setState({ status: 'anonymous', user: null });
    renderHook(() => useCommunityLikeReturn());

    expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
    expect(useCommunityDetailStore.getState().request?.designId).toBe('abc123def456');
  });

  it('pushes the resolved like into the reopened detail via the store sync', async () => {
    likeMock.mockResolvedValue(ok({ likes: 3, likedByMe: true }));
    saveCommunityReopenDesign('abc123def456');
    savePendingLikeAction({ designId: 'abc123def456', liked: true });
    authenticate();
    renderHook(() => useCommunityLikeReturn());

    await waitFor(() => {
      expect(useCommunityDetailStore.getState().likeSync).toEqual({
        designId: 'abc123def456',
        likes: 3,
        likedByMe: true,
      });
    });
  });
});
