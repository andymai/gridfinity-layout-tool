/**
 * Integration-style tests for the four `/api/auth` endpoints.
 *
 * These mock Arctic, Redis, and `fetch` (for GitHub profile lookup) and
 * exercise the request -> response wiring. The underlying session/cookie
 * primitives are unit-tested separately in api/lib.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockGoogleClient = {
  createAuthorizationURL: vi.fn(),
  validateAuthorizationCode: vi.fn(),
};
const mockGitHubClient = {
  createAuthorizationURL: vi.fn(),
  validateAuthorizationCode: vi.fn(),
};

vi.mock('arctic', () => ({
  Google: function MockGoogle() {
    return mockGoogleClient;
  },
  GitHub: function MockGitHub() {
    return mockGitHubClient;
  },
  generateState: vi.fn(),
  generateCodeVerifier: vi.fn(),
}));

let redisStore: Map<string, string>;
let redisSets: Map<string, Set<string>>;
const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  del: vi.fn(async (k: string) => {
    redisStore.delete(k);
    return 1;
  }),
  sadd: vi.fn(async (k: string, m: string) => {
    const s = redisSets.get(k) ?? new Set<string>();
    s.add(m);
    redisSets.set(k, s);
    return 1;
  }),
  srem: vi.fn(async (k: string, m: string) => {
    redisSets.get(k)?.delete(m);
    return 1;
  }),
};

vi.mock('../lib/rateLimit', () => ({
  getRedis: () => mockRedis,
}));

interface MockRes {
  _status: number;
  _body: unknown;
  _redirect?: { url: string; status: number };
  _headers: Record<string, string | string[] | number>;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  end(): MockRes;
  redirect(status: number, url: string): MockRes;
  setHeader(k: string, v: string | string[] | number): MockRes;
  getHeader(k: string): string | string[] | number | undefined;
}

function setCookies(res: MockRes): string[] {
  const v = res._headers['Set-Cookie'];
  if (v === undefined) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function makeRes(): MockRes {
  return {
    _status: 0,
    _body: null,
    _headers: {},
    _ended: false,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    end() {
      this._ended = true;
      return this;
    },
    redirect(status, url) {
      this._redirect = { url, status };
      this._status = status;
      return this;
    },
    setHeader(k, v) {
      this._headers[k] = v;
      return this;
    },
    getHeader(k) {
      return this._headers[k];
    },
  };
}

function makeReq(opts: {
  method?: string;
  query?: Record<string, string>;
  cookie?: string;
  fetchSite?: string;
  xRequestedWith?: string;
}): VercelRequest {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.fetchSite) headers['sec-fetch-site'] = opts.fetchSite;
  if (opts.xRequestedWith) headers['x-requested-with'] = opts.xRequestedWith;
  return {
    method: opts.method ?? 'GET',
    query: opts.query ?? {},
    headers,
  } as unknown as VercelRequest;
}

beforeEach(async () => {
  redisStore = new Map();
  redisSets = new Map();
  vi.clearAllMocks();
  const arctic = await import('arctic');
  (arctic.generateState as ReturnType<typeof vi.fn>).mockReturnValue('state-fixed');
  (arctic.generateCodeVerifier as ReturnType<typeof vi.fn>).mockReturnValue('verifier-fixed');
  mockGoogleClient.createAuthorizationURL.mockReturnValue(
    new URL('https://accounts.google.com/o/oauth2/v2/auth?state=mock&code_challenge=x')
  );
  mockGitHubClient.createAuthorizationURL.mockReturnValue(
    new URL('https://github.com/login/oauth/authorize?state=mock')
  );
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'g-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'g-secret');
  vi.stubEnv('GITHUB_CLIENT_ID', 'h-id');
  vi.stubEnv('GITHUB_CLIENT_SECRET', 'h-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('login/[provider]', () => {
  it('returns 400 for an unsupported provider', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    handler(makeReq({ query: { provider: 'twitter' } }), res as unknown as VercelResponse);
    expect(res._status).toBe(400);
  });

  it('redirects to Google authorize URL and sets state + verifier cookies', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    handler(makeReq({ query: { provider: 'google' } }), res as unknown as VercelResponse);
    expect(res._redirect?.status).toBe(302);
    expect(res._redirect?.url).toContain('accounts.google.com');
    const arr = setCookies(res);
    expect(arr.some((c) => c.startsWith('gflt_oauth_state=state-fixed'))).toBe(true);
    expect(arr.some((c) => c.startsWith('gflt_oauth_verifier=verifier-fixed'))).toBe(true);
  });

  it('redirects to GitHub authorize URL with state cookie only (no PKCE)', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    handler(makeReq({ query: { provider: 'github' } }), res as unknown as VercelResponse);
    expect(res._redirect?.url).toContain('github.com');
    const arr = setCookies(res);
    expect(arr.some((c) => c.includes('gflt_oauth_state=state-fixed'))).toBe(true);
    expect(arr.some((c) => c.includes('gflt_oauth_verifier='))).toBe(false);
  });

  it('returns 500 with config error when client id is missing', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    handler(makeReq({ query: { provider: 'google' } }), res as unknown as VercelResponse);
    expect(res._status).toBe(500);
  });

  it('rejects non-GET methods with 405', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    handler(
      makeReq({ method: 'POST', query: { provider: 'google' } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(405);
  });
});

describe('callback/[provider]', () => {
  function googleIdToken(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.sig`;
  }

  it('rejects when state cookie is missing', async () => {
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'google', code: 'c', state: 's' },
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it('rejects when state cookie does not match query state', async () => {
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'google', code: 'c', state: 'qs' },
        cookie: 'gflt_oauth_state=DIFFERENT',
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it('completes Google sign-in: validates code, derives uid, sets session cookie, redirects to /', async () => {
    mockGoogleClient.validateAuthorizationCode.mockResolvedValueOnce({
      idToken: () =>
        googleIdToken({
          sub: 'google-123',
          email: 'a@example.com',
          email_verified: true,
          name: 'Alice',
        }),
    });
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'google', code: 'authcode', state: 'S' },
        cookie: 'gflt_oauth_state=S; gflt_oauth_verifier=V',
      }),
      res as unknown as VercelResponse
    );
    expect(res._redirect?.url).toBe('/');
    expect(mockGoogleClient.validateAuthorizationCode).toHaveBeenCalledWith('authcode', 'V');

    // Profile + session were written to KV.
    const profileKey = [...redisStore.keys()].find(
      (k) => k.startsWith('users:') && k.endsWith(':profile')
    );
    expect(profileKey).toBeDefined();
    const profile = JSON.parse(redisStore.get(profileKey ?? '') ?? '{}');
    expect(profile.email).toBe('a@example.com');
    expect(profile.provider).toBe('google');

    const sessionKey = [...redisStore.keys()].find((k) => k.startsWith('session:'));
    expect(sessionKey).toBeDefined();

    // Session cookie set, OAuth temp cookies cleared.
    const arr = setCookies(res);
    expect(arr.some((c) => c.includes('__Host-gflt_session='))).toBe(true);
    expect(
      arr.filter((c) => c.includes('gflt_oauth_state=')).every((c) => c.includes('Max-Age=0'))
    ).toBe(true);
  });

  it('completes GitHub sign-in via /user + /user/emails fallback', async () => {
    mockGitHubClient.validateAuthorizationCode.mockResolvedValueOnce({
      accessToken: () => 'gh-access-token',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'https://api.github.com/user') {
          return {
            ok: true,
            json: async () => ({ id: 42, login: 'al', name: 'Alice', email: null }),
          } as Response;
        }
        if (url === 'https://api.github.com/user/emails') {
          return {
            ok: true,
            json: async () => [{ email: 'al@example.com', primary: true, verified: true }],
          } as Response;
        }
        throw new Error(`Unexpected fetch ${url}`);
      })
    );
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'github', code: 'authcode', state: 'S' },
        cookie: 'gflt_oauth_state=S',
      }),
      res as unknown as VercelResponse
    );
    expect(res._redirect?.url).toBe('/');
    const profileKey = [...redisStore.keys()].find((k) => k.endsWith(':profile'));
    const profile = JSON.parse(redisStore.get(profileKey ?? '') ?? '{}');
    expect(profile.email).toBe('al@example.com');
    expect(profile.provider).toBe('github');
  });

  it('rejects when Google account email is unverified', async () => {
    mockGoogleClient.validateAuthorizationCode.mockResolvedValueOnce({
      idToken: () => googleIdToken({ sub: 'x', email: 'x@x', email_verified: false }),
    });
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'google', code: 'c', state: 'S' },
        cookie: 'gflt_oauth_state=S; gflt_oauth_verifier=V',
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });
});

describe('logout', () => {
  it('rejects non-POST with 405', async () => {
    const { default: handler } = await import('./logout');
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(405);
  });

  it('rejects without X-Requested-With header (CSRF)', async () => {
    const { default: handler } = await import('./logout');
    const res = makeRes();
    await handler(
      makeReq({ method: 'POST', fetchSite: 'same-origin' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(403);
  });

  it('returns 204 and clears cookie when no session is present', async () => {
    const { default: handler } = await import('./logout');
    const res = makeRes();
    await handler(
      makeReq({ method: 'POST', fetchSite: 'same-origin', xRequestedWith: 'gflt' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(204);
    expect(setCookies(res).some((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('deletes the session record when token is present', async () => {
    redisStore.set(
      'session:tok',
      JSON.stringify({
        userId: 'u1',
        provider: 'google',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })
    );
    const { default: handler } = await import('./logout');
    const res = makeRes();
    await handler(
      makeReq({
        method: 'POST',
        fetchSite: 'same-origin',
        xRequestedWith: 'gflt',
        cookie: '__Host-gflt_session=tok',
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(204);
    expect(redisStore.has('session:tok')).toBe(false);
  });
});

describe('me', () => {
  function seedSession(token: string, userId: string) {
    redisStore.set(
      `session:${token}`,
      JSON.stringify({
        userId,
        provider: 'google',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })
    );
  }

  function seedProfile(userId: string, email: string) {
    redisStore.set(
      `users:${userId}:profile`,
      JSON.stringify({
        userId,
        provider: 'google',
        providerSubject: 'sub-1',
        email,
        displayName: 'A',
        createdAt: Date.now(),
      })
    );
  }

  it('returns 401 without a session', async () => {
    const { default: handler } = await import('./me');
    const res = makeRes();
    await handler(
      makeReq({ method: 'GET', fetchSite: 'same-origin' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(401);
  });

  it('returns the profile for a valid session', async () => {
    seedSession('tok', 'u1');
    seedProfile('u1', 'a@example.com');
    const { default: handler } = await import('./me');
    const res = makeRes();
    await handler(
      makeReq({
        method: 'GET',
        fetchSite: 'same-origin',
        cookie: '__Host-gflt_session=tok',
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({
      userId: 'u1',
      provider: 'google',
      email: 'a@example.com',
      displayName: 'A',
    });
  });

  it('returns 401 when the profile has been deleted but session lingers', async () => {
    seedSession('tok', 'u1');
    const { default: handler } = await import('./me');
    const res = makeRes();
    await handler(
      makeReq({
        method: 'GET',
        fetchSite: 'same-origin',
        cookie: '__Host-gflt_session=tok',
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(401);
  });
});
