import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import { useSessionStore } from '@/core/sync/session/useSession';
import {
  loadPendingPublishAction,
  savePendingPublishAction,
} from '@/shared/utils/communityPendingAction';
import { useCommunityPublishReturn } from './useCommunityPublishReturn';

const KEY = 'gridfinity-community-pending-publish-v1';

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

describe('useCommunityPublishReturn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    useSessionStore.setState({ status: 'unknown', user: null });
    enableFlag(true);
  });

  it('navigates to the pending design once the session resolves authenticated', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    authenticate();
    renderHook(() => useCommunityPublishReturn());
    expect(window.location.pathname).toBe('/designer');
    expect(new URLSearchParams(window.location.search).get('id')).toBe('design-1');
    expect(loadPendingPublishAction()?.designId).toBe('design-1');
  });

  it('does not navigate while the session is unresolved, then navigates on auth', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    const { rerender } = renderHook(() => useCommunityPublishReturn());
    expect(window.location.pathname).toBe('/');
    authenticate();
    rerender();
    expect(window.location.pathname).toBe('/designer');
  });

  it('clears the pending action when the session resolves anonymous', () => {
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    useSessionStore.setState({ status: 'anonymous', user: null });
    renderHook(() => useCommunityPublishReturn());
    expect(window.location.pathname).toBe('/');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('leaves the URL alone when already on the pending design', () => {
    window.history.replaceState(null, '', '/designer?id=design-1');
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    authenticate();
    renderHook(() => useCommunityPublishReturn());
    expect(loadPendingPublishAction()?.designId).toBe('design-1');
  });

  it('does nothing while the flag is off', () => {
    enableFlag(false);
    savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
    authenticate();
    renderHook(() => useCommunityPublishReturn());
    expect(window.location.pathname).toBe('/');
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });
});
