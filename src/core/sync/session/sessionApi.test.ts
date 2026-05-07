import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMe, signInUrl, signOut } from './sessionApi';

describe('sessionApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getMe', () => {
    it('returns the session user on 200', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'u1',
            provider: 'google',
            email: 'a@example.com',
            displayName: 'Alice',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const user = await getMe();
      expect(user?.userId).toBe('u1');
    });

    it('returns null on 401', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
      expect(await getMe()).toBe(null);
    });

    it('throws on a server error', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(getMe()).rejects.toThrow('500');
    });
  });

  describe('signOut', () => {
    it('resolves on 204', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await expect(signOut()).resolves.toBeUndefined();
    });

    it('treats 401 as already-signed-out (idempotent)', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
      await expect(signOut()).resolves.toBeUndefined();
    });

    it('throws on other failures', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(signOut()).rejects.toThrow('500');
    });
  });

  it('signInUrl returns the provider login path', () => {
    expect(signInUrl('google')).toBe('/api/auth/login/google');
    expect(signInUrl('github')).toBe('/api/auth/login/github');
  });
});
