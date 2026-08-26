/**
 * Tests for the Google OAuth provider. Mocks the `arctic` Google class (so no
 * network call to Google's token endpoint); `generateCodeVerifier` is the real
 * implementation. Everything else — callback URL construction, id_token
 * decoding, profile mapping — runs the real provider code.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as ArcticModule from 'arctic';

const mocks = vi.hoisted(() => ({
  googleCtor: vi.fn(),
  createAuthorizationURL: vi.fn(),
  validateAuthorizationCode: vi.fn(),
}));

vi.mock('arctic', async (importOriginal) => {
  const actual = await importOriginal<typeof ArcticModule>();
  return {
    ...actual,
    Google: class {
      constructor(...args: unknown[]) {
        mocks.googleCtor(...args);
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

import { googleProvider } from './google.js';

function makeIdToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('googleProvider', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
    };
    delete process.env.OAUTH_REDIRECT_BASE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    mocks.googleCtor.mockClear();
    mocks.createAuthorizationURL.mockClear();
    mocks.validateAuthorizationCode.mockReset();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('config', () => {
    it('throws when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are unset', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      expect(() => googleProvider.buildAuthorizationUrl('state')).toThrow(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured'
      );
    });

    it('throws when only GOOGLE_CLIENT_ID is unset', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      expect(() => googleProvider.buildAuthorizationUrl('state')).toThrow(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured'
      );
    });
  });

  describe('callback URL construction', () => {
    it('appends the callback path to OAUTH_REDIRECT_BASE_URL', () => {
      process.env.OAUTH_REDIRECT_BASE_URL = 'https://gridfinity.example';
      googleProvider.buildAuthorizationUrl('s');

      expect(mocks.googleCtor).toHaveBeenCalledWith(
        'g-id',
        'g-secret',
        'https://gridfinity.example/api/auth/callback/google'
      );
    });

    it('strips a trailing slash from OAUTH_REDIRECT_BASE_URL before appending the callback path', () => {
      process.env.OAUTH_REDIRECT_BASE_URL = 'https://gridfinity.example/';
      googleProvider.buildAuthorizationUrl('s');

      expect(mocks.googleCtor).toHaveBeenCalledWith(
        'g-id',
        'g-secret',
        'https://gridfinity.example/api/auth/callback/google'
      );
    });

    it('falls back to getBaseUrl() (localhost default) when OAUTH_REDIRECT_BASE_URL is unset', () => {
      googleProvider.buildAuthorizationUrl('s');

      expect(mocks.googleCtor).toHaveBeenCalledWith(
        'g-id',
        'g-secret',
        'https://localhost:3000/api/auth/callback/google'
      );
    });

    it('falls back through getBaseUrl() to VERCEL_URL when OAUTH_REDIRECT_BASE_URL is unset', () => {
      process.env.VERCEL_URL = 'gflt-preview.vercel.app';
      googleProvider.buildAuthorizationUrl('s');

      expect(mocks.googleCtor).toHaveBeenCalledWith(
        'g-id',
        'g-secret',
        'https://gflt-preview.vercel.app/api/auth/callback/google'
      );
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('generates a PKCE code verifier and passes it plus the openid/profile/email scopes', () => {
      process.env.OAUTH_REDIRECT_BASE_URL = 'https://gridfinity.example';
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth?state=s');
      mocks.createAuthorizationURL.mockReturnValue(url);

      const result = googleProvider.buildAuthorizationUrl('state-abc');

      expect(result.url).toBe(url);
      expect(typeof result.codeVerifier).toBe('string');
      expect(result.codeVerifier?.length).toBeGreaterThan(0);
      expect(mocks.createAuthorizationURL).toHaveBeenCalledWith('state-abc', result.codeVerifier, [
        'openid',
        'profile',
        'email',
      ]);
    });
  });

  describe('exchangeCode', () => {
    it('throws when no codeVerifier is supplied, without constructing the Google client', async () => {
      await expect(googleProvider.exchangeCode({ code: 'c' })).rejects.toThrow(
        'Google requires a PKCE verifier'
      );
      expect(mocks.googleCtor).not.toHaveBeenCalled();
    });

    it('passes the code and codeVerifier through to validateAuthorizationCode', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () =>
          makeIdToken({
            sub: 'sub-1',
            email: 'a@example.com',
            email_verified: true,
            name: 'Alice',
          }),
      });

      await googleProvider.exchangeCode({ code: 'auth-code', codeVerifier: 'verifier-1' });

      expect(mocks.validateAuthorizationCode).toHaveBeenCalledWith('auth-code', 'verifier-1');
    });

    it('maps a verified id_token payload to a ProviderProfile', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () =>
          makeIdToken({
            sub: 'sub-42',
            email: 'alice@example.com',
            email_verified: true,
            name: 'Alice Example',
          }),
      });

      const profile = await googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' });

      expect(profile).toEqual({
        subject: 'sub-42',
        email: 'alice@example.com',
        verifiedEmails: ['alice@example.com'],
        displayName: 'Alice Example',
      });
    });

    it('maps a payload with no name to an undefined displayName', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () =>
          makeIdToken({ sub: 'sub-42', email: 'alice@example.com', email_verified: true }),
      });

      const profile = await googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' });

      expect(profile.displayName).toBeUndefined();
    });

    it('throws on a malformed id_token that is not three dot-separated parts', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({ idToken: () => 'not-a-jwt' });

      await expect(googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(
        'Malformed id_token'
      );
    });

    it('throws on an id_token whose payload segment is not valid JSON', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const body = Buffer.from('not-json').toString('base64url');
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () => `${header}.${body}.sig`,
      });

      await expect(googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(
        'Malformed id_token payload'
      );
    });

    it('throws when the id_token has no sub claim', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () => makeIdToken({ email: 'a@example.com', email_verified: true }),
      });

      await expect(googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(
        'Google id_token missing sub'
      );
    });

    it('throws when the id_token has no email claim', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () => makeIdToken({ sub: 'sub-1' }),
      });

      await expect(googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(
        'Google account has no verified email'
      );
    });

    it('throws when email_verified is explicitly false', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () => makeIdToken({ sub: 'sub-1', email: 'a@example.com', email_verified: false }),
      });

      await expect(googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(
        'Google account has no verified email'
      );
    });

    it('accepts an email when email_verified is omitted entirely (only an explicit false blocks it)', async () => {
      mocks.validateAuthorizationCode.mockResolvedValue({
        idToken: () => makeIdToken({ sub: 'sub-1', email: 'a@example.com' }),
      });

      const profile = await googleProvider.exchangeCode({ code: 'c', codeVerifier: 'v' });

      expect(profile.email).toBe('a@example.com');
    });
  });
});
