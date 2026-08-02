// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, FORCED_SIGN_OUT_EVENT } from './apiFetch';

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches credentials: include and X-Requested-With', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await apiFetch('/api/auth/me');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' })
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Requested-With')).toBe('gflt');
  });

  it('omits X-Requested-With when csrf: false is passed', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await apiFetch('/api/auth/me', { csrf: false });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Requested-With')).toBe(null);
  });

  it('preserves caller-provided headers alongside X-Requested-With', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await apiFetch('/api/auth/me', {
      headers: { 'Content-Type': 'application/json' },
    });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('X-Requested-With')).toBe('gflt');
  });

  it('dispatches forced-sign-out event on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);
    await apiFetch('/api/sync/manifest');
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });

  it('does not dispatch forced-sign-out for non-401 errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);
    await apiFetch('/api/sync/manifest');
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });

  it('skips the forced-sign-out dispatch on 401 when suppressForcedSignOut is true', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);
    const response = await apiFetch('/api/community/abc', { suppressForcedSignOut: true });
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });

  it('a suppressed 401 does not consume the latch a non-suppressed 401 relies on', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);
    await Promise.all([
      apiFetch('/api/community/abc', { suppressForcedSignOut: true }),
      apiFetch('/api/sync/manifest'),
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });

  it('still sends credentials and CSRF header with suppressForcedSignOut', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await apiFetch('/api/community/abc', { suppressForcedSignOut: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/abc',
      expect.objectContaining({ credentials: 'include' })
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Requested-With')).toBe('gflt');
    const passed = fetchMock.mock.calls[0][1] as Record<string, unknown>;
    expect('suppressForcedSignOut' in passed).toBe(false);
  });
});
