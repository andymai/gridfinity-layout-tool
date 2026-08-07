/**
 * Tests for /api/sync/account DELETE — the cascading account-deletion
 * endpoint. The most important property to verify is idempotency: the
 * same request repeated after partial failure must produce the same
 * end-state without throwing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { communityDesignBlobPath } from '../lib/communityStore';

let redisStore: Map<string, string>;
let redisHashes: Map<string, Map<string, string>>;
let redisSets: Map<string, Set<string>>;
let redisZsets: Map<string, Map<string, number>>;
let blobStore: Map<string, unknown>;

const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  del: vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const k of keys) {
      if (redisStore.delete(k)) count++;
      if (redisHashes.delete(k)) count++;
      if (redisSets.delete(k)) count++;
      if (redisZsets.delete(k)) count++;
    }
    return count;
  }),
  smembers: vi.fn(async (k: string) => Array.from(redisSets.get(k) ?? [])),
  sadd: vi.fn(async (k: string, m: string) => {
    const s = redisSets.get(k) ?? new Set<string>();
    s.add(m);
    redisSets.set(k, s);
    return 1;
  }),
  srem: vi.fn(async (k: string, ...members: string[]) => {
    const s = redisSets.get(k);
    if (!s) return 0;
    let count = 0;
    for (const m of members) {
      if (s.delete(m)) count++;
    }
    if (s.size === 0) redisSets.delete(k);
    return count;
  }),
  zrem: vi.fn(async (k: string, ...members: string[]) => {
    const z = redisZsets.get(k);
    if (!z) return 0;
    let count = 0;
    for (const m of members) {
      if (z.delete(m)) count++;
    }
    if (z.size === 0) redisZsets.delete(k);
    return count;
  }),
  hexists: vi.fn(async (k: string, f: string) => (redisHashes.get(k)?.has(f) ? 1 : 0)),
  hincrby: vi.fn(async (k: string, f: string, by: number) => {
    const h = redisHashes.get(k) ?? new Map<string, string>();
    const next = Number(h.get(f) ?? '0') + by;
    h.set(f, String(next));
    redisHashes.set(k, h);
    return next;
  }),
  hkeys: vi.fn(async (k: string) => Array.from(redisHashes.get(k)?.keys() ?? [])),
  hget: vi.fn(async (k: string, f: string) => redisHashes.get(k)?.get(f) ?? null),
  hset: vi.fn(async (k: string, f: string | Record<string, string>, v?: string) => {
    const h = redisHashes.get(k) ?? new Map<string, string>();
    if (typeof f === 'object') {
      for (const [field, value] of Object.entries(f)) h.set(field, value);
    } else {
      h.set(f, String(v));
    }
    redisHashes.set(k, h);
    return 1;
  }),
  exists: vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const k of keys) {
      if (redisHashes.has(k) || redisSets.has(k) || redisZsets.has(k) || redisStore.has(k)) {
        count++;
      }
    }
    return count;
  }),
  zadd: vi.fn(async (k: string, score: number, m: string) => {
    const z = redisZsets.get(k) ?? new Map<string, number>();
    z.set(m, score);
    redisZsets.set(k, z);
    return 1;
  }),
  hgetall: vi.fn(async (k: string) => Object.fromEntries(redisHashes.get(k) ?? new Map())),
  zcard: vi.fn(async (k: string) => redisZsets.get(k)?.size ?? 0),
  // The print purge routes its writes through the store helpers, which
  // pipeline. Applying each queued command against the same maps keeps the
  // fake's end-state honest instead of silently no-oping.
  pipeline: vi.fn(() => {
    const queued: (() => Promise<unknown>)[] = [];
    const chain = {
      del: (...keys: string[]) => {
        queued.push(() => mockRedis.del(...keys));
        return chain;
      },
      zrem: (k: string, ...members: string[]) => {
        queued.push(() => mockRedis.zrem(k, ...members));
        return chain;
      },
      srem: (k: string, ...members: string[]) => {
        queued.push(() => mockRedis.srem(k, ...members));
        return chain;
      },
      hset: (k: string, fields: Record<string, string>) => {
        queued.push(() => mockRedis.hset(k, fields));
        return chain;
      },
      // zadd XX: update an existing member's score, never add one.
      zadd: (k: string, ...args: unknown[]) => {
        queued.push(async () => {
          const [flag, score, member] = args as [string, number, string];
          if (flag === 'XX' && !redisZsets.get(k)?.has(member)) return 0;
          return mockRedis.zadd(k, score, member);
        });
        return chain;
      },
      exec: async () => {
        const results: [null, unknown][] = [];
        for (const run of queued) results.push([null, await run()]);
        return results;
      },
    };
    return chain;
  }),
};

vi.mock('../lib/rateLimit', () => ({
  getRedis: () => mockRedis,
  getClientIP: () => '127.0.0.1',
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock('../lib/session', () => ({
  requireSession: vi.fn(async () => ({
    userId: 'user-1',
    provider: 'google',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  })),
}));

const deleteBlobMock = vi.fn(async (path: string) => {
  blobStore.delete(path);
});

vi.mock('../lib/blobStore', () => ({
  putJson: vi.fn(),
  getJson: vi.fn(async (path: string) => blobStore.get(path) ?? null),
  deleteBlob: (path: string) => deleteBlobMock(path),
  headBlob: vi.fn(),
}));

interface MockRes {
  _status: number;
  _body: unknown;
  _headers: Record<string, string | string[] | number>;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  end(): MockRes;
  setHeader(k: string, v: string | string[] | number): MockRes;
  getHeader(k: string): string | string[] | number | undefined;
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
    setHeader(k, v) {
      this._headers[k] = v;
      return this;
    },
    getHeader(k) {
      return this._headers[k];
    },
  };
}

function makeReq(opts: { method?: string } = {}): VercelRequest {
  return {
    method: opts.method ?? 'DELETE',
    query: {},
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

function setHash(key: string, fields: Record<string, string>) {
  redisHashes.set(key, new Map(Object.entries(fields)));
}

function setSet(key: string, members: string[]) {
  redisSets.set(key, new Set(members));
}

function setZset(key: string, members: Record<string, number>) {
  redisZsets.set(key, new Map(Object.entries(members)));
}

function seedCommunityDesign(
  id: string,
  authorPublicId: string,
  opts: {
    likes?: string[];
    children?: string[];
    reports?: string[];
    parentId?: string;
  } = {}
) {
  blobStore.set(communityDesignBlobPath(id), {
    id,
    authorPublicId,
    thumbnails: [`https://blob.example/community/thumbs/${id}-1-0.webp`],
    meshUrl: `https://blob.example/community/meshes/${id}-1.glb`,
    lineage:
      opts.parentId === undefined
        ? null
        : {
            parentId: opts.parentId,
            rootId: opts.parentId,
            parentName: 'Parent',
            parentAuthorName: 'Ada',
            rootAuthorName: 'Ada',
          },
  });
  setHash(`community:design:${id}`, { id, likes: String(opts.likes?.length ?? 0), status: 'live' });
  if (opts.likes) setSet(`community:likes:${id}`, opts.likes);
  if (opts.children) setSet(`community:children:${id}`, opts.children);
  if (opts.reports) {
    setSet(`community:reports:${id}`, opts.reports);
    setHash(`community:reportReasons:${id}`, { spam: String(opts.reports.length) });
  }
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  redisSets = new Map();
  redisZsets = new Map();
  blobStore = new Map();
  vi.clearAllMocks();
  vi.stubEnv('TOKEN_SALT', 'test-salt');
  deleteBlobMock.mockImplementation(async (path: string) => {
    blobStore.delete(path);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DELETE /api/sync/account', () => {
  it('cascades to sessions, blobs, and KV keys', async () => {
    setSet('users:user-1:sessions', ['tok-a', 'tok-b']);
    redisStore.set('session:tok-a', 'a');
    redisStore.set('session:tok-b', 'b');
    redisStore.set('users:user-1:profile', '{}');
    redisStore.set('users:user-1:indexUpdatedAt', '12345');
    setHash('users:user-1:index:layouts', { 'lay-1': '{}', 'lay-2': '{}' });
    setHash('users:user-1:index:designs', { 'des-1': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});
    blobStore.set('users/user-1/layouts/lay-2.json', {});
    blobStore.set('users/user-1/designs/des-1.json', {});

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);

    expect(res._status).toBe(204);

    // Sessions deleted.
    expect(redisStore.has('session:tok-a')).toBe(false);
    expect(redisStore.has('session:tok-b')).toBe(false);

    // KV state gone.
    expect(redisStore.has('users:user-1:profile')).toBe(false);
    expect(redisStore.has('users:user-1:indexUpdatedAt')).toBe(false);
    expect(redisHashes.has('users:user-1:index:layouts')).toBe(false);
    expect(redisHashes.has('users:user-1:index:designs')).toBe(false);
    expect(redisSets.has('users:user-1:sessions')).toBe(false);

    // Blobs gone.
    expect(blobStore.size).toBe(0);

    // Cookie cleared.
    const cookieHeader = res._headers['Set-Cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader.map(String) : [String(cookieHeader)];
    expect(cookies.some((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('is idempotent — replaying after partial failure is safe', async () => {
    // Run the cascade once.
    setSet('users:user-1:sessions', ['tok-a']);
    redisStore.set('session:tok-a', 'a');
    setHash('users:user-1:index:layouts', { 'lay-1': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});

    const { default: handler } = await import('./account');
    const firstRes = makeRes();
    await handler(makeReq(), firstRes as unknown as VercelResponse);
    expect(firstRes._status).toBe(204);

    // Replay with everything already gone — should still 204.
    const replayRes = makeRes();
    await handler(makeReq(), replayRes as unknown as VercelResponse);
    expect(replayRes._status).toBe(204);
  });

  it('continues the cascade when a single blob delete fails', async () => {
    setHash('users:user-1:index:layouts', { 'lay-1': '{}', 'lay-2': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});
    blobStore.set('users/user-1/layouts/lay-2.json', {});

    deleteBlobMock.mockImplementationOnce(async () => {
      throw new Error('blob storage transient');
    });

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);

    expect(res._status).toBe(204);
    // KV state still cleared even though a blob failed.
    expect(redisHashes.has('users:user-1:index:layouts')).toBe(false);
  });

  it('removes every community key for a user with published designs and likes', async () => {
    const { deriveAuthorPublicId } = await import('../lib/communityIds');
    const authorPublicId = deriveAuthorPublicId('user-1');
    expect(authorPublicId).not.toBeNull();
    const authorKey = `community:author:${String(authorPublicId)}`;

    seedCommunityDesign('cd-1', String(authorPublicId), {
      likes: ['user-2', 'user-3'],
      children: ['remix-1'],
    });
    seedCommunityDesign('cd-2', String(authorPublicId), { reports: ['user-4'] });
    setSet('community:published:user-1', ['cd-1', 'cd-2']);
    setSet(authorKey, ['cd-1', 'cd-2']);
    setZset('community:index:newest', { 'cd-1': 1, 'cd-2': 2, 'other-cd': 3 });
    setZset('community:index:remixes', { 'cd-1': 1, 'other-cd': 0 });
    setZset('community:index:likes', { 'cd-1': 2, 'cd-2': 0, 'other-cd': 5 });

    setSet('community:liked:user-1', ['oth-1', 'oth-2', 'oth-3']);
    for (const id of ['oth-1', 'oth-2', 'oth-3']) {
      setHash(`community:design:${id}`, { id, likes: '5', status: 'live' });
      setSet(`community:likes:${id}`, ['user-1', 'user-9']);
    }
    setSet('community:denylist', ['user-1', 'user-5']);

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    // Published-design blobs gone: record via path, assets via stored URLs.
    expect(blobStore.has(communityDesignBlobPath('cd-1'))).toBe(false);
    expect(blobStore.has(communityDesignBlobPath('cd-2'))).toBe(false);
    expect(deleteBlobMock).toHaveBeenCalledWith(
      'https://blob.example/community/thumbs/cd-1-1-0.webp'
    );
    expect(deleteBlobMock).toHaveBeenCalledWith('https://blob.example/community/meshes/cd-1-1.glb');
    expect(deleteBlobMock).toHaveBeenCalledWith(
      'https://blob.example/community/thumbs/cd-2-1-0.webp'
    );
    expect(deleteBlobMock).toHaveBeenCalledWith('https://blob.example/community/meshes/cd-2-1.glb');

    // Per-design keys gone.
    for (const id of ['cd-1', 'cd-2']) {
      expect(redisHashes.has(`community:design:${id}`)).toBe(false);
      expect(redisSets.has(`community:likes:${id}`)).toBe(false);
      expect(redisSets.has(`community:children:${id}`)).toBe(false);
      expect(redisSets.has(`community:reports:${id}`)).toBe(false);
      expect(redisHashes.has(`community:reportReasons:${id}`)).toBe(false);
    }

    // Sort-index memberships removed, other designs untouched.
    for (const sort of ['newest', 'remixes', 'likes']) {
      const zset = redisZsets.get(`community:index:${sort}`);
      expect(zset?.has('cd-1')).toBe(false);
      expect(zset?.has('cd-2')).toBe(false);
      expect(zset?.has('other-cd')).toBe(true);
    }

    // Liked designs: membership removed, counts decremented, other likers kept.
    for (const id of ['oth-1', 'oth-2', 'oth-3']) {
      expect(redisSets.get(`community:likes:${id}`)).toEqual(new Set(['user-9']));
      expect(redisHashes.get(`community:design:${id}`)?.get('likes')).toBe('4');
    }

    // User-scoped keys gone. Deny-list membership survives deletion: the
    // userId is deterministic, so dropping it would let a banned publisher
    // reset the ban by deleting and recreating the account.
    expect(redisSets.has('community:liked:user-1')).toBe(false);
    expect(redisSets.has('community:published:user-1')).toBe(false);
    expect(redisSets.has(authorKey)).toBe(false);
    expect(redisSets.get('community:denylist')).toEqual(new Set(['user-1', 'user-5']));
  });

  it('removes the deleted designs from every liker reverse liked set', async () => {
    const { deriveAuthorPublicId } = await import('../lib/communityIds');
    const authorPublicId = String(deriveAuthorPublicId('user-1'));
    seedCommunityDesign('cd-1', authorPublicId, { likes: ['user-2', 'user-3'] });
    setSet('community:published:user-1', ['cd-1']);
    setSet('community:liked:user-2', ['cd-1', 'other-cd']);
    setSet('community:liked:user-3', ['cd-1']);

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    expect(redisSets.get('community:liked:user-2')).toEqual(new Set(['other-cd']));
    expect(redisSets.has('community:liked:user-3')).toBe(false);
  });

  it('removes a deleted remix from its parent design children set', async () => {
    const { deriveAuthorPublicId } = await import('../lib/communityIds');
    const authorPublicId = String(deriveAuthorPublicId('user-1'));
    seedCommunityDesign('remix-1', authorPublicId, { parentId: 'parent-1' });
    setSet('community:published:user-1', ['remix-1']);
    seedCommunityDesign('parent-1', 'other-author', { children: ['remix-1', 'other-remix'] });
    setSet('community:published:user-2', ['parent-1']);

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    expect(redisSets.get('community:children:parent-1')).toEqual(new Set(['other-remix']));
    expect(blobStore.has(communityDesignBlobPath('parent-1'))).toBe(true);
  });

  it('removes the deleted user from every design they reported', async () => {
    seedCommunityDesign('reported-cd', 'other-author', { reports: ['user-1', 'user-9'] });
    setSet('community:published:user-2', ['reported-cd']);
    setSet('community:reported:user-1', ['reported-cd']);

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    expect(redisSets.get('community:reports:reported-cd')).toEqual(new Set(['user-9']));
    expect(redisSets.has('community:reported:user-1')).toBe(false);
  });

  it('leaves other users community data untouched when the user has none', async () => {
    setHash('users:user-1:index:layouts', { 'lay-1': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});

    seedCommunityDesign('other-cd', 'other-author', { likes: ['user-2'] });
    setSet('community:published:user-2', ['other-cd']);
    setSet('community:author:other-author', ['other-cd']);
    setSet('community:liked:user-2', ['other-cd']);
    setSet('community:denylist', ['user-5']);
    setZset('community:index:newest', { 'other-cd': 1 });

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    expect(blobStore.has(communityDesignBlobPath('other-cd'))).toBe(true);
    expect(redisHashes.get('community:design:other-cd')?.get('likes')).toBe('1');
    expect(redisSets.get('community:likes:other-cd')).toEqual(new Set(['user-2']));
    expect(redisSets.get('community:published:user-2')).toEqual(new Set(['other-cd']));
    expect(redisSets.get('community:author:other-author')).toEqual(new Set(['other-cd']));
    expect(redisSets.get('community:liked:user-2')).toEqual(new Set(['other-cd']));
    expect(redisSets.get('community:denylist')).toEqual(new Set(['user-5']));
    expect(redisZsets.get('community:index:newest')?.has('other-cd')).toBe(true);
    expect(redisHashes.has('users:user-1:index:layouts')).toBe(false);
  });

  it('does not decrement a liked design twice on cascade replay', async () => {
    setSet('community:liked:user-1', ['oth-1']);
    setHash('community:design:oth-1', { id: 'oth-1', likes: '3', status: 'live' });
    setSet('community:likes:oth-1', ['user-1', 'user-9']);
    // Simulate a partial failure: the liked set survived the first run.
    const { default: handler } = await import('./account');

    const firstRes = makeRes();
    await handler(makeReq(), firstRes as unknown as VercelResponse);
    expect(firstRes._status).toBe(204);
    expect(redisHashes.get('community:design:oth-1')?.get('likes')).toBe('2');

    setSet('community:liked:user-1', ['oth-1']);
    const replayRes = makeRes();
    await handler(makeReq(), replayRes as unknown as VercelResponse);
    expect(replayRes._status).toBe(204);
    expect(redisHashes.get('community:design:oth-1')?.get('likes')).toBe('2');
  });

  it('rescores the likes index and clamps at zero on the like decrement (A13)', async () => {
    setSet('community:liked:user-1', ['live-1', 'drift-1']);
    setHash('community:design:live-1', { id: 'live-1', likes: '3', status: 'live' });
    setSet('community:likes:live-1', ['user-1']);
    setZset('community:index:likes', { 'live-1': 3 });
    // Counter already behind the set (drift): the decrement must clamp at 0.
    setHash('community:design:drift-1', { id: 'drift-1', likes: '0', status: 'live' });
    setSet('community:likes:drift-1', ['user-1']);
    setZset('community:index:likes', { 'live-1': 3, 'drift-1': 0 });

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    expect(redisHashes.get('community:design:live-1')?.get('likes')).toBe('2');
    expect(redisZsets.get('community:index:likes')?.get('live-1')).toBe(2);
    // Clamped, never negative, in both the hash and the index.
    expect(redisHashes.get('community:design:drift-1')?.get('likes')).toBe('0');
    expect(redisZsets.get('community:index:likes')?.get('drift-1')).toBe(0);
  });

  it('does not rescore a hidden design into the likes index on account deletion (A13)', async () => {
    setSet('community:liked:user-1', ['hidden-1']);
    setHash('community:design:hidden-1', { id: 'hidden-1', likes: '2', status: 'hidden' });
    setSet('community:likes:hidden-1', ['user-1']);
    // A hidden design is de-indexed; a plain ZADD would resurrect it.
    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(204);
    expect(redisHashes.get('community:design:hidden-1')?.get('likes')).toBe('1');
    expect(redisZsets.get('community:index:likes')?.has('hidden-1')).not.toBe(true);
  });

  // A print report carries the user's display name and their uploaded photos
  // and is served publicly for any still-live design, so the cascade skipping
  // it left the most personally-identifiable content of all in place forever.
  describe('community prints', () => {
    const PHOTO = 'https://blob.example/community/prints/design-a-photo-0.webp';

    function seedOwnPrint(designId: string, authorPublicId: string): void {
      setHash(`community:print:${designId}:${authorPublicId}`, {
        designId,
        authorPublicId,
        authorName: 'Printer Pat',
        photos: JSON.stringify([PHOTO]),
        material: 'pla',
        nozzleMm: '0.4',
        layerHeightMm: '0.2',
        printMinutes: '120',
        filamentGrams: '30',
        printer: 'other',
        printerOther: 'Homebrew',
        fitVerdict: 'as-designed',
        note: '',
        rev: '1',
        createdAt: '1000',
        updatedAt: '1000',
        status: 'live',
      });
      setZset(`community:prints:${designId}`, { [authorPublicId]: 1000 });
      setSet('community:printed:user-1', [designId]);
      setHash(`community:design:${designId}`, { id: designId, status: 'live', prints: '1' });
    }

    async function runCascade(): Promise<void> {
      const { default: handler } = await import('./account');
      const res = makeRes();
      await handler(makeReq(), res as unknown as VercelResponse);
      expect(res._status).toBe(204);
    }

    it('purges the print record, its list membership, and its photo blobs', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      const author = deriveAuthorPublicId('user-1');
      expect(author).not.toBeNull();
      seedOwnPrint('design-a', String(author));
      blobStore.set(PHOTO, {});

      await runCascade();

      expect(redisHashes.has(`community:print:design-a:${String(author)}`)).toBe(false);
      expect(redisZsets.get('community:prints:design-a')?.size ?? 0).toBe(0);
      expect(redisSets.has('community:printed:user-1')).toBe(false);
      expect(deleteBlobMock).toHaveBeenCalledWith(PHOTO);
    });

    it('resyncs the surviving design print count', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      seedOwnPrint('design-a', String(deriveAuthorPublicId('user-1')));

      await runCascade();

      expect(redisHashes.get('community:design:design-a')?.get('prints')).toBe('0');
    });

    it('clears a design cover promoted from a deleted print photo', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      seedOwnPrint('design-a', String(deriveAuthorPublicId('user-1')));
      redisHashes.get('community:design:design-a')?.set('coverPhotoUrl', PHOTO);

      await runCascade();

      expect(redisHashes.get('community:design:design-a')?.get('coverPhotoUrl')).toBe('');
    });

    it('drops the user from every print they reported', async () => {
      setSet('community:printReported:user-1', ['design-b:authorxyz']);
      setSet('community:printReports:design-b:authorxyz', ['user-1', 'user-7']);

      await runCascade();

      expect(redisSets.get('community:printReports:design-b:authorxyz')).toEqual(
        new Set(['user-7'])
      );
      expect(redisSets.has('community:printReported:user-1')).toBe(false);
    });

    // The community cascade DELs the cards for designs this user published
    // before the print purge runs. syncCommunityPrintCount HSETs the card, and
    // HSET creates the key — so resyncing unconditionally resurrected the just
    // deleted design as a malformed, never-expiring hash holding only `prints`.
    it('does not resurrect the card of a design the user published and printed', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      const author = String(deriveAuthorPublicId('user-1'));
      seedCommunityDesign('own-design', author);
      setSet('community:published:user-1', ['own-design']);
      seedOwnPrint('own-design', author);

      await runCascade();

      expect(redisHashes.has('community:design:own-design')).toBe(false);
    });

    it('still resyncs the count on someone else design', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      seedOwnPrint('design-a', String(deriveAuthorPublicId('user-1')));
      setSet('community:published:user-2', ['design-a']);

      await runCascade();

      expect(redisHashes.get('community:design:design-a')?.get('prints')).toBe('0');
    });

    // A print is addressed by the SALTED author id. If TOKEN_SALT was rotated,
    // the derived id names keys that never existed, every delete no-ops, and
    // dropping the reverse index would orphan the photos with nothing left
    // pointing at them.
    it('keeps the reverse index when no print could be resolved', async () => {
      setSet('community:printed:user-1', ['design-unresolvable']);

      await runCascade();

      expect(redisSets.get('community:printed:user-1')).toEqual(new Set(['design-unresolvable']));
    });

    it('drops the reverse index once the prints are actually purged', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      seedOwnPrint('design-a', String(deriveAuthorPublicId('user-1')));

      await runCascade();

      expect(redisSets.has('community:printed:user-1')).toBe(false);
    });

    // Partial success still leaves unreadable records with photos on the CDN,
    // and dropping the reverse index removes the only handle on them.
    it('keeps the reverse index when only some prints resolve', async () => {
      const { deriveAuthorPublicId } = await import('../lib/communityIds');
      const author = String(deriveAuthorPublicId('user-1'));
      seedOwnPrint('design-a', author);
      // A second indexed design with no readable record under this author id.
      redisSets.get('community:printed:user-1')?.add('design-ghost');

      await runCascade();

      expect(redisSets.get('community:printed:user-1')).toEqual(new Set(['design-ghost']));
    });

    it('leaves another user print untouched', async () => {
      setHash('community:print:design-c:otherauthor', {
        designId: 'design-c',
        authorPublicId: 'otherauthor',
        material: 'pla',
        fitVerdict: 'as-designed',
        status: 'live',
        photos: '[]',
      });
      setZset('community:prints:design-c', { otherauthor: 5 });

      await runCascade();

      expect(redisHashes.has('community:print:design-c:otherauthor')).toBe(true);
      expect(redisZsets.get('community:prints:design-c')?.has('otherauthor')).toBe(true);
    });
  });

  it('returns 405 for non-DELETE methods', async () => {
    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq({ method: 'POST' }), res as unknown as VercelResponse);
    expect(res._status).toBe(405);
  });

  it('returns 429 when rate-limited', async () => {
    const rateLimit = await import('../lib/rateLimit');
    (rateLimit.checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 30,
    });
    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });
});
