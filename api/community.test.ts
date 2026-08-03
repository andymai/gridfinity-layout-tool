import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as DesignerValidationModule from './lib/designerValidation.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  requireSession: vi.fn(),
  readSession: vi.fn(),
  readSessionCookie: vi.fn(),
  validateDesignerShare: vi.fn(),
  getJson: vi.fn(),
  put: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('./lib/session.js', () => ({
  requireSession: mocks.requireSession,
  readSession: mocks.readSession,
}));

vi.mock('./lib/cookies.js', () => ({
  readSessionCookie: mocks.readSessionCookie,
}));

vi.mock('./lib/designerValidation.js', () => ({
  validateDesignerShare: mocks.validateDesignerShare,
}));

vi.mock('@vercel/blob', () => ({
  put: mocks.put,
  head: mocks.head,
  del: mocks.del,
  BlobNotFoundError: class BlobNotFoundError extends Error {},
}));

// Blob reads (lineage parent records) come from a seedable map; writes keep
// going through the real putJson so the design-blob assertions see them.
vi.mock('./lib/blobStore.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getJson: mocks.getJson };
});

import {
  communityDesignBlobPath,
  communityMeshBlobPath,
  communityParamsFingerprint,
  communityThumbBlobPath,
  setCommunityDesignStatus,
  writeCommunityCard,
  type CommunityCardMetadata,
  type CommunityDesignRecord,
} from './lib/communityStore.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityIndexKey,
  communityLikedKey,
  communityParamsHashKey,
  communityPublishedKey,
  communityPublishLockKey,
} from './lib/redisKeys.js';

class FakeRedis {
  hashes = new Map<string, Map<string, string>>();
  sets = new Map<string, Set<string>>();
  zsets = new Map<string, Map<string, number>>();
  strings = new Map<string, string>();

  async hset(key: string, fields: Record<string, string | number>): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(fields)) hash.set(field, String(value));
    this.hashes.set(key, hash);
    return Object.keys(fields).length;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const hash = this.hashes.get(key);
    return fields.map((field) => hash?.get(field) ?? null);
  }

  async hincrby(key: string, field: string, delta: number): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    const next = Number(hash.get(field) ?? 0) + delta;
    hash.set(field, String(next));
    this.hashes.set(key, hash);
    return next;
  }

  // Mirrors ioredis SET key value [PX ms] [NX]: returns 'OK' when written, null
  // when NX and the key already exists. PX (TTL) is not simulated.
  async set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null> {
    if (args.includes('NX') && this.strings.has(key)) return null;
    this.strings.set(key, value);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (
        this.hashes.has(key) ||
        this.sets.has(key) ||
        this.zsets.has(key) ||
        this.strings.has(key)
      ) {
        count += 1;
      }
    }
    return count;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key) ?? new Map<string, string>());
  }

  async sadd(key: string, member: string): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    const added = set.has(member) ? 0 : 1;
    set.add(member);
    this.sets.set(key, set);
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? new Set<string>())];
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.has(member) ? 1 : 0;
  }

  async smismember(key: string, ...members: string[]): Promise<number[]> {
    const set = this.sets.get(key);
    return members.map((member) => (set?.has(member) ? 1 : 0));
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, score);
    this.zsets.set(key, zset);
    return 1;
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.zsets.get(key)?.delete(member) ? 1 : 0;
  }

  async srem(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.delete(member) ? 1 : 0;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      const had =
        this.hashes.delete(key) ||
        this.sets.delete(key) ||
        this.zsets.delete(key) ||
        this.strings.delete(key);
      if (had) removed += 1;
    }
    return removed;
  }

  // Minimal eval supporting the publish-lock compare-and-delete script only:
  // delete KEYS[1] iff its stored value equals ARGV[1].
  async eval(_script: string, _numKeys: number, key: string, token: string): Promise<number> {
    if (this.strings.get(key) === token) {
      this.strings.delete(key);
      return 1;
    }
    return 0;
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const entries = [...(this.zsets.get(key) ?? new Map<string, number>()).entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)
    );
    return entries.slice(start, stop + 1).map(([member]) => member);
  }

  pipeline(): {
    hget: (key: string, field: string) => unknown;
    hgetall: (key: string) => unknown;
    zadd: (key: string, score: number, member: string) => unknown;
    zrem: (key: string, member: string) => unknown;
    exec: () => Promise<Array<[Error | null, unknown]>>;
  } {
    const ops: Array<() => Promise<unknown>> = [];
    const pipe = {
      hget: (key: string, field: string) => {
        ops.push(() => this.hget(key, field));
        return pipe;
      },
      hgetall: (key: string) => {
        ops.push(() => this.hgetall(key));
        return pipe;
      },
      zadd: (key: string, score: number, member: string) => {
        ops.push(() => this.zadd(key, score, member));
        return pipe;
      },
      zrem: (key: string, member: string) => {
        ops.push(() => this.zrem(key, member));
        return pipe;
      },
      srem: (key: string, member: string) => {
        ops.push(() => this.srem(key, member));
        return pipe;
      },
      del: (...keys: string[]) => {
        ops.push(() => this.del(...keys));
        return pipe;
      },
      exec: async (): Promise<Array<[Error | null, unknown]>> => {
        const out: Array<[Error | null, unknown]> = [];
        for (const op of ops) out.push([null, await op()]);
        return out;
      },
    };
    return pipe;
  }
}

function createResponse() {
  const res = {
    _status: 0,
    _body: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader() {
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as VercelResponse & { _status: number; _body: unknown };
}

async function handle(options: {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}): Promise<VercelResponse & { _status: number; _body: unknown }> {
  const res = createResponse();
  const mod = await import('./community.js');
  await mod.default(
    {
      method: options.method ?? 'POST',
      headers: {},
      body: options.body,
      query: options.query ?? {},
    } as unknown as VercelRequest,
    res
  );
  return res;
}

function webpBase64(payloadBytes = 6): string {
  return Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBP'),
    Buffer.alloc(payloadBytes),
  ]).toString('base64');
}

function glbBase64(payloadBytes = 8): string {
  return Buffer.concat([Buffer.from('glTF'), Buffer.alloc(payloadBytes)]).toString('base64');
}

function publishBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Socket Organizer',
    description: 'Holds 24 sockets.',
    authorName: 'Andy',
    category: 'tools',
    // A tool cutout so the default publish clears the B1 cutout-only gate.
    params: {
      width: 2,
      depth: 3,
      height: 6,
      gridUnitMm: 42,
      heightUnitMm: 7,
      cutouts: [{ shape: 'circle' }],
    },
    thumbnails: [webpBase64()],
    glb: glbBase64(),
    ...overrides,
  };
}

const SESSION = {
  userId: 'user-1',
  provider: 'github',
  createdAt: 0,
  expiresAt: 9_999_999_999_999,
};
const LINEAGE = {
  parentId: 'parentAAAAAA',
  rootId: 'rootBBBBBBBB',
  parentName: 'Stale Parent',
  parentAuthorName: 'StaleAuthor',
  rootAuthorName: 'RootAuthor',
};

let fake: FakeRedis;
const recordBlobs = new Map<string, unknown>();

function seedRecordBlob(id: string, overrides: Partial<CommunityDesignRecord> = {}): void {
  recordBlobs.set(communityDesignBlobPath(id), {
    id,
    authorPublicId: 'a'.repeat(32),
    authorName: 'Seeder',
    name: 'Seeded Design',
    description: '',
    category: 'tools',
    techniques: [],
    params: {},
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    lineage: null,
    thumbnails: [],
    meshUrl: '',
    photos: [],
    featured: false,
    createdAt: 1_000,
    updatedAt: 1_000,
    status: 'live',
    ...overrides,
  });
}

async function seedCard(
  overrides: Partial<CommunityCardMetadata> & { id: string },
  counters: {
    likes?: number;
    remixes?: number;
    exports?: number;
    opens?: number;
    views?: number;
  } = {},
  hiddenReason?: 'reports' | 'denylist'
): Promise<void> {
  const card: CommunityCardMetadata = {
    name: 'Seeded Design',
    parentId: '',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Seeder',
    category: 'tools',
    techniques: [],
    width: 83.5,
    depth: 125.5,
    height: 42,
    gridUnitMm: 42,
    thumbnailUrl: 'https://blob.test/seed.webp',
    isRemix: false,
    featured: false,
    createdAt: 1_000,
    updatedAt: 1_000,
    status: 'live',
    ...overrides,
  };
  await writeCommunityCard(fake as unknown as Redis, card);
  await fake.hset(communityDesignKey(card.id), {
    likes: String(counters.likes ?? 0),
    remixes: String(counters.remixes ?? 0),
    exports: String(counters.exports ?? 0),
    opens: String(counters.opens ?? 0),
    views: String(counters.views ?? 0),
    ...(hiddenReason !== undefined && { hiddenReason }),
  });
  if (card.status === 'live') {
    await fake.zadd(communityIndexKey('newest'), card.createdAt, card.id);
    await fake.zadd(communityIndexKey('remixes'), counters.remixes ?? 0, card.id);
    await fake.zadd(communityIndexKey('likes'), counters.likes ?? 0, card.id);
  }
}

function designBlobCalls(): Array<[string, string, { allowOverwrite?: boolean }]> {
  return mocks.put.mock.calls.filter((call) =>
    (call[0] as string).startsWith('community/designs/')
  ) as Array<[string, string, { allowOverwrite?: boolean }]>;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TOKEN_SALT = 'test-salt';
  process.env.COMMUNITY_PUBLISH_ENABLED = 'true';
  delete process.env.VERCEL_ENV;
  fake = new FakeRedis();
  recordBlobs.clear();
  mocks.getJson.mockImplementation(async (path: string) => recordBlobs.get(path) ?? null);
  mocks.getRedis.mockReturnValue(fake);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 });
  mocks.requireSession.mockResolvedValue(SESSION);
  mocks.readSessionCookie.mockReturnValue(null);
  mocks.readSession.mockResolvedValue(null);
  mocks.validateDesignerShare.mockImplementation((body: { params: Record<string, unknown> }) => ({
    valid: true,
    payload: { type: 'designer', version: 1, params: body.params },
  }));
  mocks.put.mockImplementation(async (path: string) => ({ url: `https://blob.test/${path}` }));
  mocks.del.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.TOKEN_SALT;
  delete process.env.COMMUNITY_PUBLISH_ENABLED;
  delete process.env.COMMUNITY_REQUIRE_CUTOUTS;
  delete process.env.VERCEL_ENV;
});

describe('POST /api/community (publish)', () => {
  it('returns 503 when the kill switch is off, before touching the session', async () => {
    delete process.env.COMMUNITY_PUBLISH_ENABLED;
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(503);
    expect((res._body as { code: string }).code).toBe('SERVICE_UNAVAILABLE');
    expect(mocks.requireSession).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated and writes nothing', async () => {
    mocks.requireSession.mockImplementation(async (_req: unknown, res: VercelResponse) => {
      res.status(401).json({ error: 'Not signed in', code: 'UNAUTHORIZED' });
      return null;
    });
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-user publish rate limit is hit', async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      retryAfterSeconds: 30,
    });
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(429);
    expect((res._body as { retryAfter: number }).retryAfter).toBe(30);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('user-1', 'community.publish');
  });

  it('returns 503 without TOKEN_SALT, after rate limiting but before validation', async () => {
    delete process.env.TOKEN_SALT;
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(503);
    expect((res._body as { code: string }).code).toBe('SERVICE_UNAVAILABLE');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('user-1', 'community.publish');
    expect(mocks.validateDesignerShare).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(fake.sets.size).toBe(0);
    expect(fake.hashes.size).toBe(0);
  });

  const invalidBodies: Array<[string, unknown, string]> = [
    ['non-object body', 'nope', 'INVALID_PAYLOAD'],
    ['non-string name', publishBody({ name: 42 }), 'INVALID_NAME'],
    ['overlong description', publishBody({ description: 'x'.repeat(501) }), 'INVALID_DESCRIPTION'],
    ['missing authorName', publishBody({ authorName: undefined }), 'INVALID_AUTHOR_NAME'],
    ['blocked name text', publishBody({ name: 'cool <script name' }), 'CONTENT_BLOCKED'],
    ['unknown category', publishBody({ category: 'gadgets' }), 'INVALID_CATEGORY'],
    ['missing params', publishBody({ params: undefined }), 'MISSING_PARAMS'],
    ['empty thumbnails', publishBody({ thumbnails: [] }), 'INVALID_THUMBNAILS'],
    [
      'non-webp thumbnail',
      publishBody({ thumbnails: [Buffer.from('notawebpfile').toString('base64')] }),
      'INVALID_THUMBNAILS',
    ],
    [
      'glb without magic bytes',
      publishBody({ glb: Buffer.from('nope nope nope').toString('base64') }),
      'INVALID_GLB',
    ],
    [
      'lineage with bad parentId',
      publishBody({ lineage: { ...LINEAGE, parentId: 'short' } }),
      'INVALID_LINEAGE',
    ],
  ];

  it.each(invalidBodies)('rejects %s with 400 and writes nothing', async (_label, body, code) => {
    const res = await handle({ body });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe(code);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('passes designer params validation failures through as 400', async () => {
    mocks.validateDesignerShare.mockReturnValue({
      valid: false,
      error: { code: 'INVALID_PARAMS', message: 'width must be 0.5-16' },
    });
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_PARAMS');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('returns 413 when the live-design quota is exhausted', async () => {
    for (let i = 0; i < 25; i++) {
      await fake.sadd(communityPublishedKey('user-1'), `design-${i}`);
      await fake.hset(communityDesignKey(`design-${i}`), { contentHash: `hash-${i}` });
    }
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(413);
    expect((res._body as { code: string }).code).toBe('SIZE_LIMIT');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('returns a neutral 403 for a deny-listed user', async () => {
    await fake.sadd(communityDenylistKey(), 'user-1');
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(403);
    const body = res._body as { error: string };
    expect(body.error.toLowerCase()).not.toContain('deny');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('publishes: assets + CAS design blob + redis card, indexes, and sets', async () => {
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(201);
    const body = res._body as { id: string; url: string };
    expect(body.id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(body.url).toContain(`/community/d/${body.id}`);

    const [designCall] = designBlobCalls();
    expect(designCall[0]).toBe(communityDesignBlobPath(body.id));
    expect(designCall[2].allowOverwrite).toBe(false);

    const record = JSON.parse(designCall[1]) as {
      authorPublicId: string;
      metrics: Record<string, number>;
      techniques: string[];
      lineage: unknown;
      thumbnails: string[];
      meshUrl: string;
      status: string;
    };
    expect(record.authorPublicId).toMatch(/^[a-f0-9]{32}$/);
    expect(record.metrics).toEqual({ width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 });
    expect(record.techniques).toEqual([]);
    expect(record.lineage).toBeNull();
    expect(record.thumbnails).toEqual([
      `https://blob.test/${communityThumbBlobPath(body.id, 1, 0)}`,
    ]);
    expect(record.meshUrl).toBe(`https://blob.test/${communityMeshBlobPath(body.id, 1)}`);
    expect(record.status).toBe('live');

    const thumbCall = mocks.put.mock.calls.find((call) =>
      (call[0] as string).startsWith('community/thumbs/')
    );
    expect((thumbCall?.[2] as { contentType: string }).contentType).toBe('image/webp');
    const meshCall = mocks.put.mock.calls.find((call) =>
      (call[0] as string).startsWith('community/meshes/')
    );
    expect((meshCall?.[2] as { contentType: string }).contentType).toBe('model/gltf-binary');

    expect(await fake.sismember(communityPublishedKey('user-1'), body.id)).toBe(1);
    expect(await fake.sismember(communityAuthorKey(record.authorPublicId), body.id)).toBe(1);
    expect(fake.zsets.get(communityIndexKey('newest'))?.has(body.id)).toBe(true);
    expect(await fake.hget(communityDesignKey(body.id), 'status')).toBe('live');
    expect(await fake.hget(communityDesignKey(body.id), 'contentHash')).toMatch(/^[a-f0-9]{32}$/);
  });

  it('rolls back redis state when a write fails mid-publish', async () => {
    const originalSadd = fake.sadd.bind(fake);
    fake.sadd = async (key: string, member: string): Promise<number> => {
      if (key.startsWith('community:author:')) {
        throw new Error('redis write failed');
      }
      return originalSadd(key, member);
    };

    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(500);

    expect(await fake.smembers(communityPublishedKey('user-1'))).toEqual([]);
    expect(fake.zsets.get(communityIndexKey('newest'))?.size ?? 0).toBe(0);
    const hashKeys = [...fake.hashes.keys()].filter((key) => key.startsWith('community:design:'));
    expect(hashKeys).toEqual([]);
  });

  it('republishing identical content returns the existing id with 200', async () => {
    const first = await handle({ body: publishBody() });
    expect(first._status).toBe(201);
    const firstId = (first._body as { id: string }).id;

    const second = await handle({ body: publishBody() });
    expect(second._status).toBe(200);
    expect((second._body as { id: string }).id).toBe(firstId);
    expect(designBlobCalls()).toHaveLength(1);
  });

  it('returns the existing id for a retry even when the user sits at the live-design cap', async () => {
    const first = await handle({ body: publishBody() });
    expect(first._status).toBe(201);
    const firstId = (first._body as { id: string }).id;

    for (let i = 0; i < 24; i++) {
      await fake.sadd(communityPublishedKey('user-1'), `design-${i}`);
      await fake.hset(communityDesignKey(`design-${i}`), { contentHash: `hash-${i}` });
    }
    expect(await fake.scard(communityPublishedKey('user-1'))).toBe(25);

    // Idempotency must run before quota: a 413 here would break retries of
    // already-published content for capped users.
    const retry = await handle({ body: publishBody() });
    expect(retry._status).toBe(200);
    expect((retry._body as { id: string }).id).toBe(firstId);
  });

  it('re-posting pre-edit content after an update mints a new design', async () => {
    const first = await handle({ body: publishBody() });
    expect(first._status).toBe(201);
    const firstId = (first._body as { id: string }).id;

    // PUT refreshes the stored contentHash to the edited content, so the
    // original content no longer matches any published design.
    await fake.hset(communityDesignKey(firstId), { contentHash: 'f'.repeat(32) });

    const again = await handle({ body: publishBody() });
    expect(again._status).toBe(201);
    expect((again._body as { id: string }).id).not.toBe(firstId);
    expect(designBlobCalls()).toHaveLength(2);
  });

  it('takes lineage snapshot fields from the live parent, never the client', async () => {
    await seedCard({
      id: LINEAGE.parentId,
      name: 'Real Parent',
      authorName: 'RealAuthor',
      status: 'live',
    });
    // The parent is a root design, so the chain's root is the parent itself.
    seedRecordBlob(LINEAGE.parentId, { name: 'Real Parent', authorName: 'RealAuthor' });
    const spoofed = { ...LINEAGE, rootId: LINEAGE.parentId, rootAuthorName: 'Impostor' };
    const res = await handle({ body: publishBody({ lineage: spoofed }) });
    expect(res._status).toBe(201);
    const id = (res._body as { id: string }).id;
    const [designCall] = designBlobCalls();
    const record = JSON.parse(designCall[1]) as { lineage: Record<string, string> };
    expect(record.lineage.parentName).toBe('Real Parent');
    expect(record.lineage.parentAuthorName).toBe('RealAuthor');
    expect(record.lineage.rootId).toBe(LINEAGE.parentId);
    expect(record.lineage.rootAuthorName).toBe('RealAuthor');
    expect(await fake.hget(communityDesignKey(id), 'isRemix')).toBe('1');
    expect(await fake.sismember(communityChildrenKey(LINEAGE.parentId), id)).toBe(1);
  });

  it('keeps the deleted-root snapshot from the parent record, never the client', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Real Parent', authorName: 'RealAuthor' });
    seedRecordBlob(LINEAGE.parentId, {
      lineage: {
        parentId: 'grandpaCCCCC',
        rootId: LINEAGE.rootId,
        parentName: 'Grandpa',
        parentAuthorName: 'Gramps',
        rootAuthorName: 'RootAuthor',
      },
    });
    const res = await handle({
      body: publishBody({ lineage: { ...LINEAGE, rootAuthorName: 'Impostor' } }),
    });
    expect(res._status).toBe(201);
    const [designCall] = designBlobCalls();
    const record = JSON.parse(designCall[1]) as { lineage: Record<string, string> };
    expect(record.lineage.rootId).toBe(LINEAGE.rootId);
    // The root is legitimately gone here, so the parent's stored snapshot
    // survives; the client's claimed name is ignored.
    expect(record.lineage.rootAuthorName).toBe('RootAuthor');
  });

  it('refreshes the root snapshot too when the root is still live', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Real Parent', authorName: 'RealAuthor' });
    await seedCard({ id: LINEAGE.rootId, name: 'Real Root', authorName: 'RealRootAuthor' });
    seedRecordBlob(LINEAGE.parentId, {
      lineage: {
        parentId: LINEAGE.rootId,
        rootId: LINEAGE.rootId,
        parentName: 'Real Root',
        parentAuthorName: 'RealRootAuthor',
        rootAuthorName: 'RealRootAuthor',
      },
    });
    const res = await handle({ body: publishBody({ lineage: LINEAGE }) });
    expect(res._status).toBe(201);
    const [designCall] = designBlobCalls();
    const record = JSON.parse(designCall[1]) as { lineage: Record<string, string> };
    expect(record.lineage.rootAuthorName).toBe('RealRootAuthor');
  });

  it('rejects a client rootId that does not match the parent chain', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Real Parent', authorName: 'RealAuthor' });
    // Parent is a root design; crediting an unrelated design as root must fail.
    seedRecordBlob(LINEAGE.parentId);
    const res = await handle({ body: publishBody({ lineage: LINEAGE }) });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_LINEAGE');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rejects lineage whose parent is missing', async () => {
    const res = await handle({ body: publishBody({ lineage: LINEAGE }) });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_LINEAGE');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rejects lineage whose parent is not live', async () => {
    await seedCard({ id: LINEAGE.parentId, status: 'hidden' });
    seedRecordBlob(LINEAGE.parentId);
    const res = await handle({ body: publishBody({ lineage: LINEAGE }) });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_LINEAGE');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rejects lineage whose parent record blob is missing', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Real Parent', authorName: 'RealAuthor' });
    const res = await handle({
      body: publishBody({ lineage: { ...LINEAGE, rootId: LINEAGE.parentId } }),
    });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_LINEAGE');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rolls back uploaded assets and the record blob when a Redis write fails', async () => {
    fake.hset = async () => {
      throw new Error('redis down');
    };
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(500);

    const uploadedPaths = mocks.put.mock.calls.map((call) => call[0] as string);
    const assetUrls = uploadedPaths
      .filter((path) => !path.startsWith('community/designs/'))
      .map((path) => `https://blob.test/${path}`);
    expect(assetUrls).toHaveLength(2);
    expect(mocks.del.mock.calls.flat(2)).toEqual(
      expect.arrayContaining([...assetUrls, expect.stringContaining('community/designs/')])
    );
  });

  it('rolls back uploaded assets when the record blob write itself fails', async () => {
    mocks.put.mockImplementation(async (path: string) => {
      if (path.startsWith('community/designs/')) throw new Error('blob store down');
      return { url: `https://blob.test/${path}` };
    });
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(500);
    expect(mocks.del.mock.calls.flat(2)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('community/thumbs/'),
        expect.stringContaining('community/meshes/'),
      ])
    );
  });
});

describe('POST /api/community — hardening guards', () => {
  const noCutoutParams = { width: 2, depth: 3, height: 6, gridUnitMm: 42, heightUnitMm: 7 };

  it('rejects a publish without a tool cutout under the default cutout-only policy (B1)', async () => {
    const res = await handle({ body: publishBody({ params: noCutoutParams }) });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('CUTOUT_REQUIRED');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('allows a cutout-free publish when COMMUNITY_REQUIRE_CUTOUTS=false (B1 relax lever)', async () => {
    process.env.COMMUNITY_REQUIRE_CUTOUTS = 'false';
    const res = await handle({ body: publishBody({ params: noCutoutParams }) });
    expect(res._status).toBe(201);
  });

  it('returns a soft retry when the per-user publish lock is held (A9)', async () => {
    await fake.set(communityPublishLockKey('user-1'), '1');
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(409);
    expect((res._body as { code: string }).code).toBe('PUBLISH_IN_PROGRESS');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('releases the publish lock after a successful publish (A9)', async () => {
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(201);
    // A second publish of new content is not blocked by a leaked lock.
    expect(await fake.get(communityPublishLockKey('user-1'))).toBeNull();
  });

  it('lock release is compare-and-delete: a stale release cannot free a re-acquired lock (A9 fencing)', async () => {
    const key = communityPublishLockKey('user-1');
    // Our publish overran its TTL; a second request now holds the lock under a
    // fresh token. Our release must not delete that newer lock.
    await fake.set(key, 'newer-token');
    const cad =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    expect(await fake.eval(cad, 1, key, 'our-stale-token')).toBe(0);
    expect(await fake.get(key)).toBe('newer-token');
    expect(await fake.eval(cad, 1, key, 'newer-token')).toBe(1);
    expect(await fake.get(key)).toBeNull();
  });

  it("rejects a duplicate of another author's live design (B3)", async () => {
    const fp = communityParamsFingerprint(publishBody().params as Record<string, unknown>);
    await fake.set(communityParamsHashKey(fp), 'otherDesign0');
    await fake.hset(communityDesignKey('otherDesign0'), {
      status: 'live',
      authorPublicId: 'b'.repeat(32),
    });
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(409);
    expect((res._body as { code: string }).code).toBe('DUPLICATE_DESIGN');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("does not treat the author's own live design as a duplicate (B3)", async () => {
    const fp = communityParamsFingerprint(publishBody().params as Record<string, unknown>);
    const authorPublicId = (await import('./lib/communityIds.js')).deriveAuthorPublicId(
      'user-1'
    ) as string;
    await fake.set(communityParamsHashKey(fp), 'ownDesign000');
    await fake.hset(communityDesignKey('ownDesign000'), { status: 'live', authorPublicId });
    // Different name -> different content hash, so idempotency does not short
    // circuit; the params match but same-author is not a duplicate.
    const res = await handle({ body: publishBody({ name: 'A Fresh Take' }) });
    expect(res._status).toBe(201);
  });

  it('rejects a verbatim re-upload of a built-in example (B3)', async () => {
    process.env.COMMUNITY_REQUIRE_CUTOUTS = 'false';
    const { EXAMPLE_DESIGNS } = await import('@/features/bin-designer/data/examples');
    // importActual bypasses the top-level designerValidation mock so the params
    // fingerprint matches the committed example-hash set (built from
    // real-sanitized params).
    const { validateDesignerShare } = await vi.importActual<typeof DesignerValidationModule>(
      './lib/designerValidation.js'
    );
    mocks.validateDesignerShare.mockImplementation(
      (body: { params: Record<string, unknown> }, size: number) =>
        validateDesignerShare({ type: 'designer', version: 1, params: body.params }, size)
    );
    const res = await handle({ body: publishBody({ params: EXAMPLE_DESIGNS[0].params }) });
    expect(res._status).toBe(409);
    expect((res._body as { code: string }).code).toBe('DUPLICATE_DESIGN');
  });

  it('does not resurface a hidden own design as an idempotency hit (A8)', async () => {
    const first = await handle({ body: publishBody() });
    const firstId = (first._body as { id: string }).id;
    await fake.hset(communityDesignKey(firstId), { status: 'hidden' });
    const second = await handle({ body: publishBody() });
    expect(second._status).toBe(201);
    expect((second._body as { id: string }).id).not.toBe(firstId);
  });

  it('bumps the parent (== root) remix count and rescores the index on remix publish (A1)', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Parent', authorName: 'PA' });
    seedRecordBlob(LINEAGE.parentId, { name: 'Parent', authorName: 'PA' });
    const res = await handle({
      body: publishBody({ lineage: { ...LINEAGE, rootId: LINEAGE.parentId } }),
    });
    expect(res._status).toBe(201);
    expect(await fake.hget(communityDesignKey(LINEAGE.parentId), 'remixes')).toBe('1');
    expect(fake.zsets.get(communityIndexKey('remixes'))?.get(LINEAGE.parentId)).toBe(1);
  });

  it('bumps both parent and root when they differ (A1)', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Parent', authorName: 'PA' });
    await seedCard({ id: LINEAGE.rootId, name: 'Root', authorName: 'RA' });
    seedRecordBlob(LINEAGE.parentId, {
      lineage: {
        parentId: LINEAGE.rootId,
        rootId: LINEAGE.rootId,
        parentName: 'Root',
        parentAuthorName: 'RA',
        rootAuthorName: 'RA',
      },
    });
    const res = await handle({ body: publishBody({ lineage: LINEAGE }) });
    expect(res._status).toBe(201);
    expect(await fake.hget(communityDesignKey(LINEAGE.parentId), 'remixes')).toBe('1');
    expect(await fake.hget(communityDesignKey(LINEAGE.rootId), 'remixes')).toBe('1');
  });

  it('rejects a remix whose params are identical to the parent (B4)', async () => {
    await seedCard({ id: LINEAGE.parentId, name: 'Parent', authorName: 'PA' });
    seedRecordBlob(LINEAGE.parentId, {
      name: 'Parent',
      authorName: 'PA',
      params: publishBody().params as Record<string, unknown>,
    });
    const res = await handle({
      body: publishBody({ lineage: { ...LINEAGE, rootId: LINEAGE.parentId } }),
    });
    expect(res._status).toBe(409);
    expect((res._body as { code: string }).code).toBe('REMIX_UNCHANGED');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('records the params-hash duplicate index on a successful publish (B3)', async () => {
    const res = await handle({ body: publishBody() });
    expect(res._status).toBe(201);
    const id = (res._body as { id: string }).id;
    const fp = communityParamsFingerprint(publishBody().params as Record<string, unknown>);
    expect(await fake.get(communityParamsHashKey(fp))).toBe(id);
  });
});

describe('POST /api/community — deterministic mine pagination', () => {
  it('breaks tied timestamps by id for a stable total order (A12)', async () => {
    await seedCard({ id: 'zzz111111111', createdAt: 5_000 });
    await seedCard({ id: 'aaa111111111', createdAt: 5_000 });
    await seedCard({ id: 'mmm111111111', createdAt: 5_000 });
    for (const id of ['zzz111111111', 'aaa111111111', 'mmm111111111']) {
      await fake.sadd(communityPublishedKey('user-1'), id);
    }
    const res = await handle({ method: 'GET', query: { mine: '1' } });
    const ids = (res._body as { items: Array<{ id: string }> }).items.map((item) => item.id);
    expect(ids).toEqual(['aaa111111111', 'mmm111111111', 'zzz111111111']);
  });
});

describe('GET /api/community (list)', () => {
  it('rate limits reads per IP', async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      retryAfterSeconds: 12,
    });
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('203.0.113.1', 'community.read');
  });

  it('rejects an unknown sort', async () => {
    const res = await handle({ method: 'GET', query: { sort: 'oldest' } });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('pages newest-first, 24 per page, with a resumable cursor', async () => {
    for (let i = 0; i < 30; i++) {
      const id = `d${String(i).padStart(2, '0')}`;
      await seedCard({ id, createdAt: 1_000 + i, updatedAt: 1_000 + i });
    }

    const first = await handle({ method: 'GET' });
    expect(first._status).toBe(200);
    const firstBody = first._body as {
      items: Array<{ id: string; counts: { likes: number }; metrics: { width: number } }>;
      nextCursor: string | null;
    };
    expect(firstBody.items).toHaveLength(24);
    expect(firstBody.items[0].id).toBe('d29');
    expect(firstBody.items[23].id).toBe('d06');
    expect(firstBody.items[0].metrics.width).toBe(83.5);
    expect(firstBody.nextCursor).toBe('24');

    const second = await handle({ method: 'GET', query: { cursor: '24' } });
    const secondBody = second._body as { items: Array<{ id: string }>; nextCursor: string | null };
    expect(secondBody.items.map((item) => item.id)).toEqual([
      'd05',
      'd04',
      'd03',
      'd02',
      'd01',
      'd00',
    ]);
    expect(secondBody.nextCursor).toBeNull();
  });

  it('sorts by likes with counts from the card hash', async () => {
    await seedCard({ id: 'liked-mid' }, { likes: 5 });
    await seedCard({ id: 'liked-top' }, { likes: 9 });
    await seedCard({ id: 'liked-low' }, { likes: 1 });

    const res = await handle({ method: 'GET', query: { sort: 'likes' } });
    const body = res._body as { items: Array<{ id: string; counts: { likes: number } }> };
    expect(body.items.map((item) => item.id)).toEqual(['liked-top', 'liked-mid', 'liked-low']);
    expect(body.items[0].counts.likes).toBe(9);
  });

  it('filters by category and never serves non-live designs publicly', async () => {
    await seedCard({ id: 'kitchen-live', category: 'kitchen' });
    await seedCard({ id: 'tools-live', category: 'tools' });
    await seedCard({ id: 'kitchen-hidden', category: 'kitchen', status: 'hidden' });
    // A hidden design lingering in the index must still be filtered out.
    await fake.zadd(communityIndexKey('newest'), 5_000, 'kitchen-hidden');

    const res = await handle({ method: 'GET', query: { category: 'kitchen' } });
    const body = res._body as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual(['kitchen-live']);
  });

  it('mine includes own hidden designs but not removed ones or other authors', async () => {
    await seedCard({ id: 'mine-live', createdAt: 3_000 });
    await seedCard({ id: 'mine-hidden', status: 'hidden', createdAt: 2_000 });
    await seedCard({ id: 'mine-removed', status: 'removed', createdAt: 1_000 });
    await seedCard({ id: 'other-live', createdAt: 4_000 });
    for (const id of ['mine-live', 'mine-hidden', 'mine-removed']) {
      await fake.sadd(communityPublishedKey('user-1'), id);
    }
    await fake.sadd(communityPublishedKey('user-2'), 'other-live');

    const res = await handle({ method: 'GET', query: { mine: '1' } });
    expect(res._status).toBe(200);
    const body = res._body as { items: Array<{ id: string; status: string }> };
    expect(body.items.map((item) => item.id)).toEqual(['mine-live', 'mine-hidden']);
    expect(body.items[1].status).toBe('hidden');
    expect(mocks.requireSession).toHaveBeenCalled();
  });

  it('mine requires a session', async () => {
    mocks.requireSession.mockImplementation(async (_req: unknown, res: VercelResponse) => {
      res.status(401).json({ error: 'Not signed in', code: 'UNAUTHORIZED' });
      return null;
    });
    const res = await handle({ method: 'GET', query: { mine: '1' } });
    expect(res._status).toBe(401);
  });

  it('anonymous list never consults the session', async () => {
    await seedCard({ id: 'public-live' });
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    expect(mocks.requireSession).not.toHaveBeenCalled();
  });

  it('returns empty likedIds for an anonymous caller', async () => {
    await seedCard({ id: 'public-live' });
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    expect((res._body as { likedIds: string[] }).likedIds).toEqual([]);
  });

  it('returns likedIds for the session caller, scoped to the returned page', async () => {
    await seedCard({ id: 'liked-one', createdAt: 3_000 });
    await seedCard({ id: 'not-liked00', createdAt: 2_000 });
    await seedCard({ id: 'liked-two', createdAt: 1_000 });
    await fake.sadd(communityLikedKey('user-1'), 'liked-one');
    await fake.sadd(communityLikedKey('user-1'), 'liked-two');
    // Liked but off this page (deleted or filtered out): must not leak in.
    await fake.sadd(communityLikedKey('user-1'), 'off-page-id0');
    mocks.readSessionCookie.mockReturnValue('session-token');
    mocks.readSession.mockResolvedValue(SESSION);

    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    const body = res._body as { items: Array<{ id: string }>; likedIds: string[] };
    expect(body.items.map((item) => item.id)).toEqual(['liked-one', 'not-liked00', 'liked-two']);
    expect(body.likedIds).toEqual(['liked-one', 'liked-two']);
    // Heart state is a public-surface nicety: it must come from the cookie
    // session, never the 401-sending requireSession.
    expect(mocks.requireSession).not.toHaveBeenCalled();
  });

  it('degrades to anonymous likedIds when the session read throws', async () => {
    await seedCard({ id: 'public-live' });
    mocks.readSessionCookie.mockReturnValue('session-token');
    mocks.readSession.mockRejectedValue(new Error('redis flaked'));
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    expect((res._body as { likedIds: string[] }).likedIds).toEqual([]);
  });

  it('serves a valid feature reason on a featured card', async () => {
    await seedCard({ id: 'featured0001', featured: true });
    await fake.hset(communityDesignKey('featured0001'), { featureReason: 'clever' });

    const res = await handle({ method: 'GET' });
    const body = res._body as { items: Array<{ id: string; featureReason?: string }> };
    expect(body.items.find((i) => i.id === 'featured0001')?.featureReason).toBe('clever');
  });

  it('drops a stored reason that is no longer in the union', async () => {
    await seedCard({ id: 'featured0002', featured: true });
    await fake.hset(communityDesignKey('featured0002'), { featureReason: 'retired-reason' });

    const res = await handle({ method: 'GET' });
    const body = res._body as { items: Array<{ id: string; featureReason?: string }> };
    // The stored value is a free string; a client indexes it into a label map.
    expect(body.items.find((i) => i.id === 'featured0002')?.featureReason).toBeUndefined();
  });

  it('omits the reason on a design that is not featured', async () => {
    await seedCard({ id: 'featured0003' });
    await fake.hset(communityDesignKey('featured0003'), { featureReason: 'clever' });

    const res = await handle({ method: 'GET' });
    const body = res._body as { items: Array<{ id: string; featureReason?: string }> };
    expect(body.items.find((i) => i.id === 'featured0003')?.featureReason).toBeUndefined();
  });

  it('prefers a promoted cover photo over the render while prints are enabled', async () => {
    vi.stubEnv('COMMUNITY_PRINTS_ENABLED', 'true');
    await seedCard({ id: 'coverdesign1' });
    await fake.hset(communityDesignKey('coverdesign1'), {
      coverPhotoUrl: 'https://blob.example/cover.webp',
    });

    const res = await handle({ method: 'GET' });
    const body = res._body as { items: Array<{ id: string; thumbnailUrl: string }> };
    const item = body.items.find((i) => i.id === 'coverdesign1');
    expect(item?.thumbnailUrl).toBe('https://blob.example/cover.webp');
  });

  it('falls back to the render once the prints kill switch is off', async () => {
    vi.stubEnv('COMMUNITY_PRINTS_ENABLED', 'false');
    await seedCard({ id: 'coverdesign2' });
    await fake.hset(communityDesignKey('coverdesign2'), {
      coverPhotoUrl: 'https://blob.example/cover.webp',
    });

    const res = await handle({ method: 'GET' });
    const body = res._body as { items: Array<{ id: string; thumbnailUrl: string }> };
    const item = body.items.find((i) => i.id === 'coverdesign2');
    // Flipping the switch off must pull already-promoted photos back off the
    // grid, not strand them there.
    expect(item?.thumbnailUrl).not.toBe('https://blob.example/cover.webp');
  });

  it('mine items carry owner-only opens/views counts and the hide reason', async () => {
    await seedCard({ id: 'mine-stats00', createdAt: 3_000 }, { likes: 4, opens: 7, views: 31 });
    await seedCard(
      { id: 'mine-denied0', status: 'hidden', createdAt: 2_000 },
      { exports: 2 },
      'denylist'
    );
    await seedCard({ id: 'mine-report0', status: 'hidden', createdAt: 1_000 }, {}, 'reports');
    for (const id of ['mine-stats00', 'mine-denied0', 'mine-report0']) {
      await fake.sadd(communityPublishedKey('user-1'), id);
    }

    const res = await handle({ method: 'GET', query: { mine: '1' } });
    expect(res._status).toBe(200);
    const body = res._body as {
      items: Array<{
        id: string;
        counts: Record<string, number>;
        hiddenReason?: string;
      }>;
    };
    expect(body.items.map((item) => item.id)).toEqual([
      'mine-stats00',
      'mine-denied0',
      'mine-report0',
    ]);
    expect(body.items[0].counts).toEqual({
      likes: 4,
      remixes: 0,
      exports: 0,
      prints: 0,
      opens: 7,
      views: 31,
    });
    expect(body.items[0].hiddenReason).toBeUndefined();
    expect(body.items[1].hiddenReason).toBe('denylist');
    expect(body.items[2].hiddenReason).toBe('reports');
  });

  it('public list items never carry opens/views or a hide reason', async () => {
    await seedCard({ id: 'public-stats' }, { likes: 4, opens: 7, views: 31 });
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    const body = res._body as { items: Array<Record<string, unknown>> };
    expect(body.items[0].counts).toEqual({ likes: 4, remixes: 0, exports: 0, prints: 0 });
    expect(body.items[0]).not.toHaveProperty('hiddenReason');
  });

  it('mine returns likedIds for the session user too', async () => {
    await seedCard({ id: 'mine-liked00' });
    await fake.sadd(communityPublishedKey('user-1'), 'mine-liked00');
    await fake.sadd(communityLikedKey('user-1'), 'mine-liked00');
    const res = await handle({ method: 'GET', query: { mine: '1' } });
    expect(res._status).toBe(200);
    expect((res._body as { likedIds: string[] }).likedIds).toEqual(['mine-liked00']);
  });

  it('excludes a design from the list once auto-hide flips its status', async () => {
    await seedCard({ id: 'reported-des', createdAt: 5_000 });
    await seedCard({ id: 'still-live00', createdAt: 4_000 });

    const before = await handle({ method: 'GET' });
    expect((before._body as { items: Array<{ id: string }> }).items.map((i) => i.id)).toEqual([
      'reported-des',
      'still-live00',
    ]);

    // The exact flip the report threshold performs (setCommunityDesignStatus
    // to 'hidden'): status rewritten on the card hash + ZREM from every index.
    await setCommunityDesignStatus(fake as unknown as Redis, 'reported-des', 'hidden');

    const after = await handle({ method: 'GET' });
    expect((after._body as { items: Array<{ id: string }> }).items.map((i) => i.id)).toEqual([
      'still-live00',
    ]);
  });
});
