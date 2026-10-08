// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionLifecycle, useSessionStore } from './useSession';
import { apiFetch, FORCED_SIGN_OUT_EVENT } from '../apiFetch';

describe('useSessionStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useSessionStore.setState({ status: 'unknown', user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('starts in "unknown" status', () => {
    expect(useSessionStore.getState().status).toBe('unknown');
  });

  it('transitions to "authenticated" on a successful refresh', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { userId: 'u1', provider: 'google', email: 'a@x' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    await act(async () => {
      await useSessionStore.getState().refresh();
    });
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().user?.userId).toBe('u1');
  });

  it('transitions to "anonymous" on an anonymous response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false, user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
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

  it('resolves to anonymous without calling the API or broadcasting on a self-hosted build', async () => {
    vi.stubEnv('VITE_SELF_HOSTED', '1');
    const channel = new BroadcastChannel('gflt-session');
    const received: unknown[] = [];
    channel.addEventListener('message', (e) => received.push(e.data));
    await act(async () => {
      await useSessionStore.getState().refresh();
    });
    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(fetchMock).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toEqual([]);
    channel.close();
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
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false, user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    renderHook(() => useSessionLifecycle());
    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe('anonymous');
    });
  });

  it('flips to anonymous when the forced-sign-out event fires', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { userId: 'u1', provider: 'google', email: 'a@x' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
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

  it('forced-sign-out clears outbox + resets poller (cross-account leak guard)', async () => {
    // Without these cleanups, user A's queued PUTs survive into a user B
    // sign-in that picks 'merge' in the mismatch dialog, leaking A's
    // edits into B's account.
    const outboxModule = await import('../outbox');
    const pollerModule = await import('../pullState');
    const claimModule = await import('../claim');
    const order: string[] = [];
    const cancelClaimsSpy = vi
      .spyOn(claimModule, 'cancelClaims')
      .mockImplementation(async (cleanup) => {
        order.push('cancel');
        await cleanup?.();
      });
    const clearAllSpy = vi.spyOn(outboxModule, 'clearAll').mockImplementation(async () => {
      order.push('clear');
    });
    const resetPullStateSpy = vi.spyOn(pollerModule, 'resetPullState').mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { userId: 'u1', provider: 'google', email: 'a@x' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    renderHook(() => useSessionLifecycle());
    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe('authenticated');
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('gflt:forced-sign-out'));
    });

    await waitFor(() => expect(clearAllSpy).toHaveBeenCalled());
    expect(order).toEqual(['cancel', 'clear']);
    expect(resetPullStateSpy).toHaveBeenCalled();
    cancelClaimsSpy.mockRestore();
    clearAllSpy.mockRestore();
    resetPullStateSpy.mockRestore();
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
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { userId: 'u2', provider: 'github', email: 'b@x' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
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

describe('account changes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.setState({ status: 'unknown', user: null });
  });

  it('keeps a 401 to a request sent under the previous account from signing out the next', async () => {
    const user = { userId: 'u1', provider: 'google' as const, email: 'a@x' };
    useSessionStore.setState({ status: 'authenticated', user });
    let answer = (_res: Response): void => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          })
      )
    );
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);

    const pending = apiFetch('/api/sync/manifest');
    useSessionStore.setState({ user: { ...user, userId: 'u2' } });
    answer(new Response(null, { status: 401 }));
    await pending;

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });

  it('keeps the account of the newest refresh when two overlap', async () => {
    const answers: ((res: Response) => void)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answers.push(resolve);
          })
      )
    );
    const me = (userId: string): Response =>
      new Response(
        JSON.stringify({ authenticated: true, user: { userId, provider: 'google', email: 'a@x' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const older = useSessionStore.getState().applyRemoteState('authenticated');
    const newer = useSessionStore.getState().applyRemoteState('authenticated');
    answers[1](me('u2'));
    await newer;
    answers[0](me('u1'));
    await older;

    expect(useSessionStore.getState().user?.userId).toBe('u2');
  });

  it("keeps a stale 401 from signing out another tab's sign-in while its user loads", async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x' },
    });
    const answers = new Map<string, (res: Response) => void>();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            answers.set(url, resolve);
          })
      )
    );
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);

    const pending = apiFetch('/api/sync/manifest');
    void useSessionStore.getState().applyRemoteState('authenticated');
    answers.get('/api/sync/manifest')?.(new Response(null, { status: 401 }));
    await pending;

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });
});
