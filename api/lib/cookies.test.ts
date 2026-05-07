import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearOAuthCookies,
  clearSessionCookie,
  getSessionCookieName,
  readOAuthStateCookie,
  readOAuthVerifierCookie,
  readSessionCookie,
  setOAuthStateCookie,
  setOAuthVerifierCookie,
  setSessionCookie,
} from './cookies';

interface MockRes {
  _headers: Record<string, string | string[] | number>;
  setHeader(k: string, v: string | string[] | number): MockRes;
  getHeader(k: string): string | string[] | number | undefined;
}

function createMockRes(): MockRes {
  return {
    _headers: {},
    setHeader(k, v) {
      this._headers[k] = v;
      return this;
    },
    getHeader(k) {
      return this._headers[k];
    },
  };
}

function setCookies(res: MockRes): string[] {
  const v = res._headers['Set-Cookie'];
  if (v === undefined) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function reqWithCookies(header: string): VercelRequest {
  return { headers: { cookie: header } } as unknown as VercelRequest;
}

describe('cookies — environment switching', () => {
  const originalEnv = process.env.VERCEL_ENV;
  afterEach(() => {
    process.env.VERCEL_ENV = originalEnv;
  });

  it('uses __Host- prefix and Secure in production', () => {
    process.env.VERCEL_ENV = 'production';
    expect(getSessionCookieName()).toBe('__Host-gflt_session');
    const res = createMockRes();
    setSessionCookie(res as unknown as VercelResponse, 'tok');
    const cookie = setCookies(res)[0];
    expect(cookie).toContain('__Host-gflt_session=tok');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=2592000');
  });

  it('drops __Host- and Secure outside production-shaped envs', () => {
    process.env.VERCEL_ENV = undefined;
    expect(getSessionCookieName()).toBe('gflt_session');
    const res = createMockRes();
    setSessionCookie(res as unknown as VercelResponse, 'tok');
    const cookie = setCookies(res)[0];
    expect(cookie).toContain('gflt_session=tok');
    expect(cookie).not.toContain('Secure');
    expect(cookie).toContain('HttpOnly');
  });
});

describe('cookies — set/clear/read roundtrip', () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = 'production';
  });

  it('clears the session cookie with Max-Age=0', () => {
    const res = createMockRes();
    clearSessionCookie(res as unknown as VercelResponse);
    expect(setCookies(res)[0]).toContain('Max-Age=0');
  });

  it('reads back the session cookie from a request', () => {
    const req = reqWithCookies('__Host-gflt_session=abc123; other=xyz');
    expect(readSessionCookie(req)).toBe('abc123');
  });

  it('returns null when the cookie header is missing or has no match', () => {
    expect(readSessionCookie({ headers: {} } as unknown as VercelRequest)).toBe(null);
    expect(readSessionCookie(reqWithCookies('foo=bar'))).toBe(null);
  });

  it('reads OAuth state and verifier cookies', () => {
    const req = reqWithCookies('gflt_oauth_state=ST; gflt_oauth_verifier=VR');
    expect(readOAuthStateCookie(req)).toBe('ST');
    expect(readOAuthVerifierCookie(req)).toBe('VR');
  });

  it('accumulates multiple Set-Cookie headers (state + verifier together)', () => {
    const res = createMockRes();
    setOAuthStateCookie(res as unknown as VercelResponse, 'ST');
    setOAuthVerifierCookie(res as unknown as VercelResponse, 'VR');
    const cookies = setCookies(res);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('gflt_oauth_state=ST');
    expect(cookies[1]).toContain('gflt_oauth_verifier=VR');
  });

  it('clears both OAuth cookies in one call', () => {
    const res = createMockRes();
    clearOAuthCookies(res as unknown as VercelResponse);
    const cookies = setCookies(res);
    expect(cookies).toHaveLength(2);
    expect(cookies.every((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('sets short Max-Age (10 min) on OAuth temp cookies', () => {
    const res = createMockRes();
    setOAuthStateCookie(res as unknown as VercelResponse, 'ST');
    expect(setCookies(res)[0]).toContain('Max-Age=600');
  });
});
