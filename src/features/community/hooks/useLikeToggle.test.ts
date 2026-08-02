import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { useSessionStore } from '@/core/sync/session/useSession';
import { INITIAL_TOAST_STATE, useToastStore } from '@/core/store/toast';
import type { CommunityCard } from '@/shared/types/community';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../store/browseStore';
import { useLikeToggle } from './useLikeToggle';

vi.mock('../api/client', () => ({
  setDesignLiked: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

import { setDesignLiked } from '../api/client';
import { trackEvent } from '@/shared/analytics/posthog';

const likeMock = vi.mocked(setDesignLiked);

function card(overrides: Partial<CommunityCard> = {}): CommunityCard {
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
    counts: { likes: 12, remixes: 4, exports: 9 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    likedByMe: false,
    ...overrides,
  };
}

function storeCard(): CommunityCard {
  const item = useBrowseStore.getState().items.find((c) => c.id === 'abc123def456');
  if (!item) throw new Error('card missing from store');
  return item;
}

describe('useLikeToggle', () => {
  beforeEach(() => {
    likeMock.mockReset();
    vi.mocked(trackEvent).mockReset();
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [card()] });
    useToastStore.setState({ ...INITIAL_TOAST_STATE });
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
  });

  it('patches optimistically, then adopts the authoritative count', async () => {
    let resolveRequest: (value: Awaited<ReturnType<typeof setDesignLiked>>) => void = () => {};
    likeMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    const { result } = renderHook(() => useLikeToggle());

    let outcome: Promise<string> | undefined;
    act(() => {
      outcome = result.current(card());
    });

    // Optimistic patch lands before the request resolves.
    expect(storeCard().likedByMe).toBe(true);
    expect(storeCard().counts.likes).toBe(13);
    expect(likeMock).toHaveBeenCalledWith('abc123def456', true);

    await act(async () => {
      resolveRequest(ok({ likes: 20, likedByMe: true }));
      await expect(outcome).resolves.toBe('ok');
    });

    expect(storeCard().counts.likes).toBe(20);
    expect(storeCard().likedByMe).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith('community_like');
  });

  it('rolls back the optimistic patch and toasts on failure', async () => {
    likeMock.mockResolvedValue(err({ kind: 'server' }));
    const { result } = renderHook(() => useLikeToggle());

    await act(async () => {
      await expect(result.current(card())).resolves.toBe('error');
    });

    expect(storeCard().likedByMe).toBe(false);
    expect(storeCard().counts.likes).toBe(12);
    await waitFor(() => {
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'community.toast.likeFailed'
      );
    });
  });

  it('unlikes a liked card and tracks community_unlike', async () => {
    useBrowseStore.setState({
      items: [card({ likedByMe: true, counts: { likes: 12, remixes: 4, exports: 9 } })],
    });
    likeMock.mockResolvedValue(ok({ likes: 11, likedByMe: false }));
    const { result } = renderHook(() => useLikeToggle());

    await act(async () => {
      await expect(result.current(storeCard())).resolves.toBe('ok');
    });

    expect(likeMock).toHaveBeenCalledWith('abc123def456', false);
    expect(storeCard().likedByMe).toBe(false);
    expect(storeCard().counts.likes).toBe(11);
    expect(trackEvent).toHaveBeenCalledWith('community_unlike');
  });

  it('coalesces a reversal tapped while the first request is in flight', async () => {
    const resolvers: Array<(value: Awaited<ReturnType<typeof setDesignLiked>>) => void> = [];
    likeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    const { result } = renderHook(() => useLikeToggle());

    let first: Promise<string> | undefined;
    act(() => {
      first = result.current(card());
    });
    expect(storeCard().likedByMe).toBe(true);
    expect(likeMock).toHaveBeenCalledTimes(1);

    let second: Promise<string> | undefined;
    act(() => {
      second = result.current(storeCard());
    });
    // The reversal patches optimistically right away and rides the flight.
    expect(storeCard().likedByMe).toBe(false);
    expect(storeCard().counts.likes).toBe(12);
    await act(async () => {
      await expect(second).resolves.toBe('ok');
    });
    expect(likeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0]?.(ok({ likes: 13, likedByMe: true }));
      await Promise.resolve();
    });
    // The flight follows up with the final desired state instead of adopting
    // the now-stale server value from the first request.
    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledTimes(2);
    });
    expect(likeMock).toHaveBeenLastCalledWith('abc123def456', false);
    expect(storeCard().likedByMe).toBe(false);

    await act(async () => {
      resolvers[1]?.(ok({ likes: 12, likedByMe: false }));
      await expect(first).resolves.toBe('ok');
    });
    expect(storeCard().likedByMe).toBe(false);
    expect(storeCard().counts.likes).toBe(12);
    expect(trackEvent).toHaveBeenCalledWith('community_unlike');
  });

  it('returns signin-required for a signed-out tap without touching the store', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const { result } = renderHook(() => useLikeToggle());

    await act(async () => {
      await expect(result.current(card())).resolves.toBe('signin-required');
    });

    expect(likeMock).not.toHaveBeenCalled();
    expect(storeCard().likedByMe).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('community_signin_prompt_shown', { intent: 'like' });
  });

  it('rolls back and asks for sign-in when the session expired server-side', async () => {
    likeMock.mockResolvedValue(err({ kind: 'needsAuth' }));
    const { result } = renderHook(() => useLikeToggle());

    await act(async () => {
      await expect(result.current(card())).resolves.toBe('signin-required');
    });

    expect(storeCard().likedByMe).toBe(false);
    expect(storeCard().counts.likes).toBe(12);
  });
});
