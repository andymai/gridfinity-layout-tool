/**
 * Integration-style tests for the four `/api/auth` endpoints.
 *
 * Mocks happen at the provider abstraction boundary (`getProvider`),
 * Redis, and `fetch` — not at the OAuth library. Swapping Arctic for
 * another lib leaves these tests entirely unchanged.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { OAuthProvider, ProviderProfile } from './providers/index';
import type * as ProvidersModule from './providers/index';
import { createHash } from 'node:crypto';

const mockGoogleProvider = {
  buildAuthorizationUrl: vi.fn(),
  exchangeCode: vi.fn(),
} satisfies OAuthProvider;

const mockGitHubProvider = {
  buildAuthorizationUrl: vi.fn(),
  exchangeCode: vi.fn(),
} satisfies OAuthProvider;

vi.mock('./providers/index', async (importOriginal) => {
  const actual = await importOriginal<typeof ProvidersModule>();
  return {
    ...actual,
    getProvider: (name: string) => (name === 'google' ? mockGoogleProvider : mockGitHubProvider),
    createOAuthState: () => 'state-fixed',
  };
});

let redisStore: Map<string, string>;
let redisSets: Map<string, Set<string>>;
const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  // NX-aware: the identity map uses SET NX to decide the winner when two
  // first sign-ins for one identity race.
  set: vi.fn(async (k: string, v: string, ...args: unknown[]) => {
    if (args.includes('NX') && redisStore.has(k)) return null;
    redisStore.set(k, v);
    return 'OK';
  }),
  exists: vi.fn(async (k: string) => (redisStore.has(k) ? 1 : 0)),
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
  srem: vi.fn(async (k: string, ...members: string[]) => {
    const s = redisSets.get(k);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) if (s.delete(m)) removed++;
    return removed;
  }),
  smembers: vi.fn(async (k: string) => Array.from(redisSets.get(k) ?? [])),
  pipeline: vi.fn(() => makeAuthPipelineMock()),
};

function makeAuthPipelineMock() {
  const queue: Array<() => [Error | null, unknown]> = [];
  const pipe = {
    set: (k: string, v: string, ..._rest: unknown[]) => {
      queue.push(() => {
        redisStore.set(k, v);
        return [null, 'OK'];
      });
      return pipe;
    },
    sadd: (k: string, m: string) => {
      queue.push(() => {
        const s = redisSets.get(k) ?? new Set<string>();
        s.add(m);
        redisSets.set(k, s);
        return [null, 1];
      });
      return pipe;
    },
    exists: (k: string) => {
      queue.push(() => [null, redisStore.has(k) ? 1 : 0]);
      return pipe;
    },
    exec: vi.fn(async () => queue.map((fn) => fn())),
  };
  return pipe;
}

vi.mock('../lib/rateLimit', () => ({
  getRedis: () => mockRedis,
  getClientIP: () => '127.0.0.1',
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  })),
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

beforeEach(() => {
  redisStore = new Map();
  redisSets = new Map();
  // Sign-in resolves the user id through the salted identity map, which
  // refuses to derive a key without a salt.
  vi.stubEnv('TOKEN_SALT', 'test-salt');
  vi.clearAllMocks();
  mockGoogleProvider.buildAuthorizationUrl.mockReturnValue({
    url: new URL('https://accounts.google.com/o/oauth2/v2/auth?state=mock'),
    codeVerifier: 'verifier-fixed',
  });
  mockGitHubProvider.buildAuthorizationUrl.mockReturnValue({
    url: new URL('https://github.com/login/oauth/authorize?state=mock'),
  });
  vi.stubEnv('VERCEL_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('login/[provider]', () => {
  it('returns 400 for an unsupported provider', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    await handler(makeReq({ query: { provider: 'twitter' } }), res as unknown as VercelResponse);
    expect(res._status).toBe(400);
  });

  it('redirects to Google authorize URL and sets state + verifier cookies', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    await handler(makeReq({ query: { provider: 'google' } }), res as unknown as VercelResponse);
    expect(res._redirect?.status).toBe(302);
    expect(res._redirect?.url).toContain('accounts.google.com');
    expect(mockGoogleProvider.buildAuthorizationUrl).toHaveBeenCalledWith('state-fixed');
    const arr = setCookies(res);
    expect(arr.some((c) => c.startsWith('__Host-gflt_oauth_state=state-fixed'))).toBe(true);
    expect(arr.some((c) => c.startsWith('__Host-gflt_oauth_verifier=verifier-fixed'))).toBe(true);
  });

  it('redirects to GitHub authorize URL with state cookie only (no PKCE)', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    await handler(makeReq({ query: { provider: 'github' } }), res as unknown as VercelResponse);
    expect(res._redirect?.url).toContain('github.com');
    const arr = setCookies(res);
    expect(arr.some((c) => c.includes('__Host-gflt_oauth_state=state-fixed'))).toBe(true);
    expect(arr.some((c) => c.includes('__Host-gflt_oauth_verifier='))).toBe(false);
  });

  it('returns 500 with config error when buildAuthorizationUrl throws', async () => {
    mockGoogleProvider.buildAuthorizationUrl.mockImplementationOnce(() => {
      throw new Error('GOOGLE_CLIENT_ID not configured');
    });
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    await handler(makeReq({ query: { provider: 'google' } }), res as unknown as VercelResponse);
    expect(res._status).toBe(500);
  });

  it('rejects non-GET methods with 405', async () => {
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'POST', query: { provider: 'google' } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(405);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const rateLimit = await import('../lib/rateLimit');
    (rateLimit.checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 30,
    });
    const { default: handler } = await import('./login/[provider]');
    const res = makeRes();
    await handler(makeReq({ query: { provider: 'google' } }), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });
});

describe('callback/[provider]', () => {
  function googleProfile(): ProviderProfile {
    return {
      subject: 'google-123',
      email: 'a@example.com',
      verifiedEmails: ['a@example.com'],
      displayName: 'Alice',
    };
  }
  function githubProfile(): ProviderProfile {
    return {
      subject: '42',
      email: 'al@example.com',
      verifiedEmails: ['al@example.com', 'alice@personal.example'],
      displayName: 'Alice',
    };
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
        cookie: '__Host-gflt_oauth_state=DIFFERENT',
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it('completes Google sign-in: passes verifier, derives uid, sets session cookie, redirects to /', async () => {
    mockGoogleProvider.exchangeCode.mockResolvedValueOnce(googleProfile());
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'google', code: 'authcode', state: 'S' },
        cookie: '__Host-gflt_oauth_state=S; __Host-gflt_oauth_verifier=V',
      }),
      res as unknown as VercelResponse
    );
    expect(res._redirect?.url).toBe('/');
    expect(mockGoogleProvider.exchangeCode).toHaveBeenCalledWith({
      code: 'authcode',
      codeVerifier: 'V',
    });

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
      arr
        .filter((c) => c.includes('__Host-gflt_oauth_state='))
        .every((c) => c.includes('Max-Age=0'))
    ).toBe(true);
  });

  it('completes GitHub sign-in (no PKCE verifier needed)', async () => {
    mockGitHubProvider.exchangeCode.mockResolvedValueOnce(githubProfile());
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'github', code: 'authcode', state: 'S' },
        cookie: '__Host-gflt_oauth_state=S',
      }),
      res as unknown as VercelResponse
    );
    expect(res._redirect?.url).toBe('/');
    expect(mockGitHubProvider.exchangeCode).toHaveBeenCalledWith({
      code: 'authcode',
      codeVerifier: undefined,
    });
    const profileKey = [...redisStore.keys()].find((k) => k.endsWith(':profile'));
    const profile = JSON.parse(redisStore.get(profileKey ?? '') ?? '{}');
    expect(profile.email).toBe('al@example.com');
    expect(profile.provider).toBe('github');
  });

  // The id is now random and resolved through a salted identity map, so an
  // existing account is only recognized by that map (or, once, by its legacy
  // profile) — never by re-deriving a hash of the provider subject.
  describe('user id resolution', () => {
    // githubProfile()'s subject is '42' — a realistic sequential GitHub id,
    // and the value the legacy scheme would have hashed.
    const GITHUB_SUBJECT = '42';

    async function signInGitHub() {
      mockGitHubProvider.exchangeCode.mockResolvedValueOnce(githubProfile());
      const { default: handler } = await import('./callback/[provider]');
      const res = makeRes();
      await handler(
        makeReq({
          query: { provider: 'github', code: 'authcode', state: 'S' },
          cookie: '__Host-gflt_oauth_state=S',
        }),
        res as unknown as VercelResponse
      );
      return res;
    }

    function storedUserId(): string | undefined {
      const profileKey = [...redisStore.keys()].find((k) => k.endsWith(':profile'));
      return profileKey?.split(':')[1];
    }

    it('does not store the unsalted hash of the provider subject as the id', async () => {
      await signInGitHub();
      const uid = storedUserId();
      const unsalted = createHash('sha256')
        .update(`github:${GITHUB_SUBJECT}`)
        .digest('hex')
        .slice(0, 32);
      expect(uid).toMatch(/^[a-f0-9]{32}$/);
      expect(uid).not.toBe(unsalted);
    });

    it('adopts an existing legacy account instead of stranding it', async () => {
      const legacy = createHash('sha256')
        .update(`github:${GITHUB_SUBJECT}`)
        .digest('hex')
        .slice(0, 32);
      redisStore.set(`users:${legacy}:profile`, JSON.stringify({ userId: legacy }));

      await signInGitHub();

      expect(storedUserId()).toBe(legacy);
    });

    it('reuses the same id on a second sign-in', async () => {
      await signInGitHub();
      const first = storedUserId();
      await signInGitHub();
      expect(storedUserId()).toBe(first);
    });

    // Failing closed matters more than signing the user in: an unsalted map
    // key would rebuild the sha256(github:N) -> userId join outright.
    it('fails the sign-in rather than minting an account without TOKEN_SALT', async () => {
      vi.stubEnv('TOKEN_SALT', '');
      const res = await signInGitHub();
      expect(res._status).toBe(503);
      expect([...redisStore.keys()].some((k) => k.endsWith(':profile'))).toBe(false);
    });
  });

  it('rejects with 400 when the provider exchangeCode throws', async () => {
    mockGoogleProvider.exchangeCode.mockRejectedValueOnce(
      new Error('Google account has no verified email')
    );
    const { default: handler } = await import('./callback/[provider]');
    const res = makeRes();
    await handler(
      makeReq({
        query: { provider: 'google', code: 'c', state: 'S' },
        cookie: '__Host-gflt_oauth_state=S; __Host-gflt_oauth_verifier=V',
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

  it('returns 200 + anonymous body without a session', async () => {
    const { default: handler } = await import('./me');
    const res = makeRes();
    await handler(
      makeReq({ method: 'GET', fetchSite: 'same-origin' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ authenticated: false, user: null });
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
      authenticated: true,
      user: {
        userId: 'u1',
        provider: 'google',
        email: 'a@example.com',
        displayName: 'A',
      },
    });
  });

  it('returns 200 + anonymous body when the profile has been deleted but session lingers', async () => {
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
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ authenticated: false, user: null });
  });
});
