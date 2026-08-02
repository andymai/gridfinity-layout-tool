import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import {
  INITIAL_COMMUNITY_DIGEST_STATE,
  useCommunityDigestStore,
} from '@/core/store/communityDigest';
import { INITIAL_TOAST_STATE, useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useCommunityDigestCheck } from './useCommunityDigestCheck';

vi.mock('@/features/community/utils/communityDigestCheck', () => ({
  runCommunityDigestCheck: vi.fn(),
}));

vi.mock('@/features/community/utils/communityMilestones', () => ({
  claimMilestone: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { runCommunityDigestCheck } from '@/features/community/utils/communityDigestCheck';
import { claimMilestone } from '@/features/community/utils/communityMilestones';
import { trackEvent } from '@/shared/analytics/posthog';

const runCheckMock = vi.mocked(runCommunityDigestCheck);
const claimMock = vi.mocked(claimMilestone);
const trackEventMock = vi.mocked(trackEvent);

function enableFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
    },
  }));
}

function authenticate(userId = 'u1'): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId, provider: 'google', email: 'a@b.c' },
  });
}

beforeEach(() => {
  runCheckMock.mockReset();
  runCheckMock.mockResolvedValue([]);
  claimMock.mockReset();
  claimMock.mockReturnValue(true);
  trackEventMock.mockReset();
  useToastStore.setState(INITIAL_TOAST_STATE);
  useCommunityDigestStore.setState(INITIAL_COMMUNITY_DIGEST_STATE);
  useSessionStore.setState({ status: 'unknown', user: null });
  enableFlag(true);
});

describe('useCommunityDigestCheck', () => {
  it('runs the digest check for the signed-in user', async () => {
    authenticate('user-7');
    renderHook(() => useCommunityDigestCheck());
    await waitFor(() => expect(runCheckMock).toHaveBeenCalledWith('user-7'));
  });

  it('does nothing while the flag is off', async () => {
    enableFlag(false);
    authenticate();
    renderHook(() => useCommunityDigestCheck());
    await Promise.resolve();
    expect(runCheckMock).not.toHaveBeenCalled();
  });

  it('does nothing while the session is unknown, then runs on sign-in', async () => {
    const hook = renderHook(() => useCommunityDigestCheck());
    await Promise.resolve();
    expect(runCheckMock).not.toHaveBeenCalled();

    authenticate();
    hook.rerender();
    await waitFor(() => expect(runCheckMock).toHaveBeenCalledTimes(1));
  });

  it('resets the seam store on sign-out so no stale dot survives', async () => {
    useCommunityDigestStore.getState().setDigest({
      likesDelta: 1,
      remixesDelta: 0,
      exportsDelta: 0,
      hasDelta: true,
    });
    useSessionStore.setState({ status: 'anonymous', user: null });
    renderHook(() => useCommunityDigestCheck());
    await waitFor(() => expect(useCommunityDigestStore.getState().hasUnseenDeltas).toBe(false));
    expect(runCheckMock).not.toHaveBeenCalled();
  });

  it('clears the mine cache and mineOnly filter when the user signs out', async () => {
    const { useMineStore } = await import('@/features/community/store/mineStore');
    const { useBrowseStore } = await import('@/features/community/store/browseStore');
    authenticate('user-7');
    const hook = renderHook(() => useCommunityDigestCheck());
    await waitFor(() => expect(runCheckMock).toHaveBeenCalled());

    useMineStore.setState({
      status: 'ready',
      items: [],
      fetchedAt: Date.now(),
      forUserId: 'user-7',
    });
    useBrowseStore.getState().setMineOnly(true);

    useSessionStore.setState({ status: 'anonymous', user: null });
    hook.rerender();
    await waitFor(() => expect(useMineStore.getState().forUserId).toBeNull());
    expect(useMineStore.getState().status).toBe('idle');
    expect(useBrowseStore.getState().filters.mineOnly).toBe(false);
  });

  it('does not touch the community stores when a flag-off user signs out', async () => {
    enableFlag(false);
    const { useBrowseStore } = await import('@/features/community/store/browseStore');
    useBrowseStore.getState().setMineOnly(true);
    authenticate('user-7');
    const hook = renderHook(() => useCommunityDigestCheck());
    await Promise.resolve();

    useSessionStore.setState({ status: 'anonymous', user: null });
    hook.rerender();
    await Promise.resolve();
    await Promise.resolve();
    // Flag-off users can never have populated the community stores, so the
    // cleanup (and its lazy chunk load) must not run for them.
    expect(useBrowseStore.getState().filters.mineOnly).toBe(true);
    useBrowseStore.getState().setMineOnly(false);
  });

  it('still cleans up when the flag flips off between community use and sign-out', async () => {
    const { useMineStore } = await import('@/features/community/store/mineStore');
    const { useBrowseStore } = await import('@/features/community/store/browseStore');
    authenticate('user-7');
    const hook = renderHook(() => useCommunityDigestCheck());
    await waitFor(() => expect(runCheckMock).toHaveBeenCalled());

    useMineStore.setState({
      status: 'ready',
      items: [],
      fetchedAt: Date.now(),
      forUserId: 'user-7',
    });
    useBrowseStore.getState().setMineOnly(true);

    enableFlag(false);
    hook.rerender();
    useSessionStore.setState({ status: 'anonymous', user: null });
    hook.rerender();
    await waitFor(() => expect(useMineStore.getState().forUserId).toBeNull());
    expect(useBrowseStore.getState().filters.mineOnly).toBe(false);
  });

  it('does not touch the community stores on an anonymous boot', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const { useBrowseStore } = await import('@/features/community/store/browseStore');
    useBrowseStore.getState().setMineOnly(true);
    renderHook(() => useCommunityDigestCheck());
    await Promise.resolve();
    await Promise.resolve();
    // Never authenticated in this tab, so the cleanup (and its chunk load)
    // must not run.
    expect(useBrowseStore.getState().filters.mineOnly).toBe(true);
    useBrowseStore.getState().setMineOnly(false);
  });

  it('claims, tracks, and toasts each due milestone', async () => {
    authenticate('user-7');
    runCheckMock.mockResolvedValue(['first_remix_of_yours', 'ten_published_remixes']);
    renderHook(() => useCommunityDigestCheck());

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(2));
    expect(claimMock).toHaveBeenCalledWith('user-7', 'first_remix_of_yours');
    expect(claimMock).toHaveBeenCalledWith('user-7', 'ten_published_remixes');
    expect(trackEventMock).toHaveBeenCalledWith('community_milestone', {
      kind: 'first_remix_of_yours',
    });
    expect(trackEventMock).toHaveBeenCalledWith('community_milestone', {
      kind: 'ten_published_remixes',
    });
    const messages = useToastStore.getState().toasts.map((toast) => toast.message);
    expect(messages).toEqual(['community.milestone.firstRemix', 'community.milestone.tenRemixes']);
    expect(useToastStore.getState().toasts.every((toast) => toast.type === 'success')).toBe(true);
  });

  it('stays silent when the milestone claim is refused (already fired elsewhere)', async () => {
    authenticate();
    runCheckMock.mockResolvedValue(['hundred_prints']);
    claimMock.mockReturnValue(false);
    renderHook(() => useCommunityDigestCheck());

    await waitFor(() => expect(claimMock).toHaveBeenCalled());
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});
