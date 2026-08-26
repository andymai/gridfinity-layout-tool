/**
 * Tests for the GitHub OAuth provider. Mocks the `arctic` GitHub class (so no
 * network call to GitHub's token endpoint) and `fetch` (for the `/user` and
 * `/user/emails` REST calls); everything else — email selection, name
 * fallback, header shaping — runs the real provider code.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as ArcticModule from 'arctic';

const mocks = vi.hoisted(() => ({
  githubCtor: vi.fn(),
  createAuthorizationURL: vi.fn(),
  validateAuthorizationCode: vi.fn(),
}));

vi.mock('arctic', async (importOriginal) => {
  const actual = await importOriginal<typeof ArcticModule>();
  return {
    ...actual,
    GitHub: class {
      constructor(...args: unknown[]) {
        mocks.githubCtor(...args);
      }
      createAuthorizationURL(...args: unknown[]) {
        return mocks.createAuthorizationURL(...args);
      }
      validateAuthorizationCode(...args: unknown[]) {
        return mocks.validateAuthorizationCode(...args);
      }
    },
  };
});

import { githubProvider } from './github.js';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

interface RawGitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

function mockUser(overrides: Partial<RawGitHubUser> = {}): RawGitHubUser {
  return { id: 42, login: 'octocat', name: 'Octo Cat', email: null, ...overrides };
}

describe('githubProvider', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
    };
    vi.stubGlobal('fetch', vi.fn());
    mocks.githubCtor.mockClear();
    mocks.createAuthorizationURL.mockClear();
    mocks.validateAuthorizationCode.mockReset();
    mocks.validateAuthorizationCode.mockResolvedValue({
      accessToken: () => 'gh-access-token',
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  describe('config', () => {
    it('throws when both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are unset', () => {
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
      expect(() => githubProvider.buildAuthorizationUrl('state')).toThrow(
        'GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured'
      );
    });

    it('throws when only GITHUB_CLIENT_SECRET is unset', () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      expect(() => githubProvider.buildAuthorizationUrl('state')).toThrow(
        'GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured'
      );
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('requests read:user + user:email scopes and returns the URL with no PKCE verifier', () => {
      const url = new URL('https://github.com/login/oauth/authorize?state=s');
      mocks.createAuthorizationURL.mockReturnValue(url);

      const result = githubProvider.buildAuthorizationUrl('state-abc');

      expect(mocks.createAuthorizationURL).toHaveBeenCalledWith('state-abc', [
        'read:user',
        'user:email',
      ]);
      expect(result).toEqual({ url });
      expect(result.codeVerifier).toBeUndefined();
    });
  });

  describe('exchangeCode: email selection precedence', () => {
    it('selects the primary+verified email over a merely verified one', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser()))
        .mockResolvedValueOnce(
          jsonResponse([
            { email: 'secondary@example.com', primary: false, verified: true },
            { email: 'primary@example.com', primary: true, verified: true },
          ])
        );

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.email).toBe('primary@example.com');
    });

    it('ignores an unverified primary address in favor of a verified non-primary one', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser()))
        .mockResolvedValueOnce(
          jsonResponse([
            { email: 'unverified-primary@example.com', primary: true, verified: false },
            { email: 'verified@example.com', primary: false, verified: true },
          ])
        );

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.email).toBe('verified@example.com');
    });

    it('throws when the account has no verified email at all', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser()))
        .mockResolvedValueOnce(
          jsonResponse([{ email: 'unverified@example.com', primary: true, verified: false }])
        );

      await expect(githubProvider.exchangeCode({ code: 'c' })).rejects.toThrow(
        'GitHub account has no verified email'
      );
    });

    it('uses the /user email directly when present, even if /user/emails is malformed', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser({ email: 'public@example.com' })))
        .mockResolvedValueOnce(jsonResponse(null, false, 500));

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.email).toBe('public@example.com');
      expect(profile.verifiedEmails).toEqual(['public@example.com']);
    });

    it('does not duplicate the /user email in verifiedEmails when /user/emails also returns it', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser({ email: 'x@example.com' })))
        .mockResolvedValueOnce(
          jsonResponse([
            { email: 'x@example.com', primary: true, verified: true },
            { email: 'y@example.com', primary: false, verified: true },
          ])
        );

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.verifiedEmails).toEqual(['x@example.com', 'y@example.com']);
    });
  });

  describe('exchangeCode: profile mapping', () => {
    it('falls back to the login handle when the profile has no name', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          jsonResponse(mockUser({ name: null, login: 'octocat', email: 'x@example.com' }))
        )
        .mockResolvedValueOnce(jsonResponse([]));

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.displayName).toBe('octocat');
      expect(profile.handle).toBe('octocat');
    });

    it('uses the profile name when present', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser({ name: 'Octo Cat', email: 'x@example.com' })))
        .mockResolvedValueOnce(jsonResponse([]));

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.displayName).toBe('Octo Cat');
    });

    it('sets subject to the stringified numeric GitHub id', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser({ id: 987654, email: 'x@example.com' })))
        .mockResolvedValueOnce(jsonResponse([]));

      const profile = await githubProvider.exchangeCode({ code: 'c' });

      expect(profile.subject).toBe('987654');
    });
  });

  describe('exchangeCode: request shaping', () => {
    it('sends the exchanged access token as a Bearer header to both endpoints', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({ accessToken: () => 'tok-123' });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock
        .mockResolvedValueOnce(jsonResponse(mockUser({ email: 'x@example.com' })))
        .mockResolvedValueOnce(jsonResponse([]));

      await githubProvider.exchangeCode({ code: 'auth-code' });

      expect(mocks.validateAuthorizationCode).toHaveBeenCalledWith('auth-code');
      const expectedHeaders = {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer tok-123',
        'User-Agent': 'gridfinity-layout-tool',
      };
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.github.com/user', {
        headers: expectedHeaders,
      });
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.github.com/user/emails', {
        headers: expectedHeaders,
      });
    });

    it('throws with the response status when /user fails', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(null, false, 401)
      );

      await expect(githubProvider.exchangeCode({ code: 'c' })).rejects.toThrow('GitHub /user 401');
    });

    it('propagates a /user/emails failure when /user gave no email (the required fetch)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser({ email: null })))
        .mockRejectedValueOnce(new Error('network down'));

      await expect(githubProvider.exchangeCode({ code: 'c' })).rejects.toThrow('network down');
    });

    it('treats a non-array /user/emails response as no verified emails', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(jsonResponse(mockUser({ email: null })))
        .mockResolvedValueOnce(jsonResponse({ error: 'nope' }));

      await expect(githubProvider.exchangeCode({ code: 'c' })).rejects.toThrow(
        'GitHub account has no verified email'
      );
    });
  });
});
