// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionLifecycle, useSessionStore } from './useSession';

describe('useSessionStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useSessionStore.setState({ status: 'unknown', user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in "unknown" status', () => {
    expect(useSessionStore.getState().status).toBe('unknown');
  });

  it('transitions to "authenticated" on a successful refresh', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: 'u1', provider: 'google', email: 'a@x' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await act(async () => {
      await useSessionStore.getState().refresh();
    });
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().user?.userId).toBe('u1');
  });

  it('transitions to "anonymous" on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await act(async () => {
      await useSessionStore.getState().refresh();
    });
    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(useSessionStore.getState().user).toBe(null);
  });

  it('keeps prior state on a transient network error', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x' },
    });
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      await useSessionStore.getState().refresh();
    });
    // Stays authenticated rather than spuriously signing the user out.
    expect(useSessionStore.getState().status).toBe('authenticated');
  });
});

describe('useSessionLifecycle', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useSessionStore.setState({ status: 'unknown', user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes on mount', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    renderHook(() => useSessionLifecycle());
    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe('anonymous');
    });
  });

  it('flips to anonymous when the forced-sign-out event fires', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: 'u1', provider: 'google', email: 'a@x' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    renderHook(() => useSessionLifecycle());
    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe('authenticated');
    });
    act(() => {
      window.dispatchEvent(new CustomEvent('gflt:forced-sign-out'));
    });
    expect(useSessionStore.getState().status).toBe('anonymous');
  });
});

describe('applyRemoteState (broadcast-receiver path)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flips to anonymous without broadcasting (regression: cross-tab ping-pong)', async () => {
    const channel = new BroadcastChannel('gflt-session');
    const received: unknown[] = [];
    channel.addEventListener('message', (e) => received.push(e.data));
    await act(async () => {
      await useSessionStore.getState().applyRemoteState('anonymous');
    });
    expect(useSessionStore.getState().status).toBe('anonymous');
    // Wait one tick so any synchronous broadcast would land.
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toEqual([]);
    channel.close();
  });

  it('refreshes from /api/auth/me on remote authenticated, without broadcasting', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: 'u2', provider: 'github', email: 'b@x' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const channel = new BroadcastChannel('gflt-session');
    const received: unknown[] = [];
    channel.addEventListener('message', (e) => received.push(e.data));
    await act(async () => {
      await useSessionStore.getState().applyRemoteState('authenticated');
    });
    expect(useSessionStore.getState().user?.userId).toBe('u2');
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toEqual([]);
    channel.close();
  });
});
