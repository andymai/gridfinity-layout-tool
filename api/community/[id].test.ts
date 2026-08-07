/**
 * Tests for community design GET/PUT/DELETE/POST. The load-bearing invariants:
 *  - hidden/removed designs are indistinguishable from missing ones for
 *    everyone but their owner (POST actions 404 on non-live too)
 *  - PUT/DELETE authorize via the server-side published set, never a
 *    client-sent publishedId, and PUT can never change moderation status
 *  - PUT rewrites assets under a bumped rev and deletes the replaced rev
 *  - DELETE cleans blobs plus every Redis membership; the admin path needs
 *    a constant-time token match and is disabled without the env var
 *  - like/unlike/report require a session; open/export never consult one
 *  - report dedupes per account, auto-hides + purges assets at the
 *    threshold, and always writes the reverse index for the deletion cascade
 *  - open/export dedupe on clientId AND caller IP per weekly bucket; export
 *    credits parent and root lineage
 *  - the publish kill switch never gates actions on already-live designs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import {
  COMMUNITY_DEDUPE_TTL_SECONDS,
  communityDedupeBucket,
  communityMeshBlobPath,
  communityThumbBlobPath,
} from '../lib/communityStore.js';
import type { CommunityDesignRecord } from '../lib/communityStore.js';
import type { SessionRecord } from '../lib/session.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityExportedKey,
  communityLikedKey,
  communityLikesKey,
  communityModeratedContentKey,
  communityOpenedKey,
  communityPublishedKey,
  communityReportReasonKey,
  communityReportedKey,
  communityReportsKey,
  communityViewedKey,
} from '../lib/redisKeys.js';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  requireSession: vi.fn(),
  readSession: vi.fn(),
  readSessionCookie: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  validateCommunityPublish: vi.fn(),
  checkCommunityPublishQuota: vi.fn(),
  readCommunityDesignBlob: vi.fn(),
  writeCommunityDesignBlob: vi.fn(),
  writeCommunityCard: vi.fn(),
  removeFromCommunityIndexes: vi.fn(),
  deleteCommunityDesignBlob: vi.fn(),
  setCommunityDesignStatus: vi.fn(),
  toggleCommunityLike: vi.fn(),
}));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('../lib/session.js', () => ({
  requireSession: mocks.requireSession,
  readSession: mocks.readSession,
}));

vi.mock('../lib/cookies.js', () => ({
  readSessionCookie: mocks.readSessionCookie,
}));

vi.mock('@vercel/blob', () => ({
  put: mocks.put,
  del: mocks.del,
}));

vi.mock('../lib/communityValidation.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    validateCommunityPublish: mocks.validateCommunityPublish,
  };
});

vi.mock('../lib/communityQuota.js', () => ({
  checkCommunityPublishQuota: mocks.checkCommunityPublishQuota,
}));

const printStoreMocks = vi.hoisted(() => ({ readCommunityPrints: vi.fn() }));
vi.mock('../lib/communityPrintStore.js', () => printStoreMocks);

vi.mock('../lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readCommunityDesignBlob: mocks.readCommunityDesignBlob,
    writeCommunityDesignBlob: mocks.writeCommunityDesignBlob,
    writeCommunityCard: mocks.writeCommunityCard,
    removeFromCommunityIndexes: mocks.removeFromCommunityIndexes,
    deleteCommunityDesignBlob: mocks.deleteCommunityDesignBlob,
    setCommunityDesignStatus: mocks.setCommunityDesignStatus,
    toggleCommunityLike: mocks.toggleCommunityLike,
  };
});

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

interface FakePipeline {
  del: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
}

interface FakeRedis {
  sismember: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  scard: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  zadd: ReturnType<typeof vi.fn>;
  zrange: ReturnType<typeof vi.fn>;
  hget: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
  hmget: ReturnType<typeof vi.fn>;
  hset: ReturnType<typeof vi.fn>;
  hincrby: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
}

function createRedis(): { redis: FakeRedis; pipeline: FakePipeline } {
  // Default exec answers [err=null, result=1] per queued command, so a
  // pipelined SADD reads as "newly added" unless a test overrides exec.
  let queuedOps = 0;
  const queue = () => {
    queuedOps += 1;
    return pipeline;
  };
  const pipeline: FakePipeline = {
    del: vi.fn(queue),
    srem: vi.fn(queue),
    sadd: vi.fn(queue),
    expire: vi.fn(queue),
    exec: vi.fn(async () => Array.from({ length: queuedOps }, () => [null, 1] as [null, unknown])),
  };
  const redis: FakeRedis = {
    sismember: vi.fn(async (key: string) => (key === communityDenylistKey() ? 0 : 1)),
    smembers: vi.fn(async () => [] as string[]),
    sadd: vi.fn(async () => 1),
    scard: vi.fn(async () => 0),
    exists: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    // The params-hash duplicate index is empty by default: no other-author dup.
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    zadd: vi.fn(async () => 1),
    zrange: vi.fn(async () => [] as string[]),
    hget: vi.fn(async (_key: string, field: string) => (field === 'status' ? 'live' : null)),
    hgetall: vi.fn(async (): Promise<Record<string, string>> => ({})),
    hmget: vi.fn(async () => [null, null, null] as (string | null)[]),
    hset: vi.fn(async () => 1),
    hincrby: vi.fn(async () => 1),
    pipeline: vi.fn(() => pipeline),
  };
  return { redis, pipeline };
}

const VALID_ID = 'AbCdEf123456';
const USER_ID = 'user-1';
const PARENT_ID = 'ParentDes1gn';

const session: SessionRecord = {
  userId: USER_ID,
  provider: 'github',
  createdAt: 0,
  expiresAt: Number.MAX_SAFE_INTEGER,
};

function designRecord(overrides: Partial<CommunityDesignRecord> = {}): CommunityDesignRecord {
  return {
    id: VALID_ID,
    authorPublicId: 'author-public-id',
    authorName: 'Jo',
    name: 'Screw bin',
    description: 'A bin for screws',
    category: 'tools',
    techniques: ['scoop'],
    params: { width: 2, depth: 3, height: 6, gridUnitMm: 42 },
    metrics: { width: 2, depth: 3, height: 6, gridUnitMm: 42 },
    lineage: null,
    thumbnails: [
      `https://blob.example/community/thumbs/${VALID_ID}-3-0.webp`,
      `https://blob.example/community/thumbs/${VALID_ID}-3-1.webp`,
    ],
    meshUrl: `https://blob.example/community/meshes/${VALID_ID}-3.glb`,
    photos: [],
    featured: false,
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

function publishPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Updated bin',
    description: 'Now with a scoop',
    authorName: 'Jo',
    category: 'tools',
    // A tool cutout so updates clear the B1 cutout-only gate.
    params: { width: 4, depth: 2, height: 9, gridUnitMm: 42, cutouts: [{ shape: 'circle' }] },
    techniques: ['scoop'],
    thumbnails: ['dGh1bWItMA==', 'dGh1bWItMQ=='],
    glb: 'Z2xURgAAAAA=',
    ...overrides,
  };
}

async function handle(
  method: string,
  over: {
    id?: unknown;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  } = {}
) {
  const res = createResponse();
  const mod = await import('./[id].js');
  await mod.default(
    {
      method,
      query: { id: over.id ?? VALID_ID, ...over.query },
      headers: over.headers ?? {},
      body: over.body ?? {},
    } as unknown as VercelRequest,
    res
  );
  return res;
}

describe('community/[id]', () => {
  let redis: FakeRedis;
  let pipeline: FakePipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.COMMUNITY_ADMIN_TOKEN;
    process.env.COMMUNITY_PUBLISH_ENABLED = 'true';
    process.env.TOKEN_SALT = 'test-salt';
    ({ redis, pipeline } = createRedis());
    mocks.getRedis.mockReturnValue(redis);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.requireSession.mockResolvedValue(session);
    mocks.readSessionCookie.mockReturnValue(undefined);
    mocks.readSession.mockResolvedValue(null);
    mocks.readCommunityDesignBlob.mockResolvedValue(designRecord());
    mocks.writeCommunityDesignBlob.mockResolvedValue('https://blob.example/design.json');
    mocks.writeCommunityCard.mockResolvedValue(undefined);
    mocks.removeFromCommunityIndexes.mockResolvedValue(undefined);
    mocks.deleteCommunityDesignBlob.mockResolvedValue(undefined);
    mocks.put.mockImplementation((path: unknown) =>
      Promise.resolve({ url: `https://blob.example/${String(path)}` })
    );
    mocks.del.mockResolvedValue(undefined);
    mocks.validateCommunityPublish.mockReturnValue({ valid: true, payload: publishPayload() });
    mocks.setCommunityDesignStatus.mockResolvedValue(undefined);
    mocks.toggleCommunityLike.mockImplementation(async (...args: unknown[]) => ({
      likes: 13,
      likedByMe: args[3] === true,
    }));
  });

  afterEach(() => {
    delete process.env.COMMUNITY_ADMIN_TOKEN;
    delete process.env.COMMUNITY_PUBLISH_ENABLED;
    delete process.env.TOKEN_SALT;
  });

  describe('routing', () => {
    it('rejects an invalid design id', async () => {
      const res = await handle('GET', { id: 'not-a-valid-id!' });
      expect(res._status).toBe(400);
      expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
    });

    it('rejects unsupported methods', async () => {
      const res = await handle('PATCH');
      expect(res._status).toBe(405);
    });
  });

  describe('GET', () => {
    it('returns the full record for a live design', async () => {
      const res = await handle('GET');
      expect(res._status).toBe(200);
      const body = res._body as { design: CommunityDesignRecord };
      expect(body.design.id).toBe(VALID_ID);
      expect(body.design.params).toEqual({ width: 2, depth: 3, height: 6, gridUnitMm: 42 });
    });

    it('ships card-hash counts and anonymous like-state with the detail', async () => {
      // The stats row must not depend on the capped browse index: a design
      // past the client's 2,000-card cap still needs counts and a heart.
      redis.hmget.mockResolvedValue(['4', '2', '9', '7', '31', null]);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(redis.hmget).toHaveBeenCalledWith(
        communityDesignKey(VALID_ID),
        'likes',
        'remixes',
        'exports',
        'opens',
        'views',
        'hiddenReason'
      );
      const body = res._body as { counts: unknown; likedByMe: boolean };
      // Opens/views are owner-only stats: an anonymous detail response must
      // not even carry the keys.
      expect(body.counts).toEqual({ likes: 4, remixes: 2, exports: 9 });
      expect(body.likedByMe).toBe(false);
    });

    it('includes owner-only opens/views counts for the owner', async () => {
      redis.hmget.mockResolvedValue(['4', '2', '9', '7', '31', null]);
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { counts: unknown }).counts).toEqual({
        likes: 4,
        remixes: 2,
        exports: 9,
        opens: 7,
        views: 31,
      });
    });

    it('excludes opens/views for a signed-in non-owner', async () => {
      redis.hmget.mockResolvedValue(['4', '2', '9', '7', '31', null]);
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(0);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { counts: unknown }).counts).toEqual({
        likes: 4,
        remixes: 2,
        exports: 9,
      });
    });

    it('defaults never-incremented counters to zero', async () => {
      const res = await handle('GET');
      expect((res._body as { counts: unknown }).counts).toEqual({
        likes: 0,
        remixes: 0,
        exports: 0,
      });
    });

    it('reports likedByMe from the likes set for a signed-in caller', async () => {
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      // First sismember answers ownership (non-owner), second the likes set.
      redis.sismember.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { likedByMe: boolean }).likedByMe).toBe(true);
      expect(redis.sismember).toHaveBeenCalledWith(communityLikesKey(VALID_ID), USER_ID);
    });

    it('returns 404 when the design does not exist', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(null);
      const res = await handle('GET');
      expect(res._status).toBe(404);
      expect(res._body).toEqual({ error: 'Design not found', code: 'NOT_FOUND' });
    });

    it('marks isOwner false for an anonymous GET of a live design', async () => {
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { isOwner: boolean }).isOwner).toBe(false);
    });

    it('marks isOwner true when the session user published the live design', async () => {
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { isOwner: boolean }).isOwner).toBe(true);
      expect(redis.sismember).toHaveBeenCalledWith(communityPublishedKey(USER_ID), VALID_ID);
    });

    it('marks isOwner false for a signed-in non-publisher of a live design', async () => {
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(0);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { isOwner: boolean }).isOwner).toBe(false);
    });

    it('makes a hidden design indistinguishable from not-found for a stranger', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      const hiddenRes = await handle('GET');

      mocks.readCommunityDesignBlob.mockResolvedValue(null);
      const missingRes = await handle('GET');

      expect(hiddenRes._status).toBe(404);
      expect(hiddenRes._status).toBe(missingRes._status);
      expect(hiddenRes._body).toEqual(missingRes._body);
    });

    it('hides a hidden design from a signed-in non-owner', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(0);
      const res = await handle('GET');
      expect(res._status).toBe(404);
    });

    it('returns a hidden design to its owner', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { design: CommunityDesignRecord }).design.status).toBe('hidden');
      expect(redis.sismember).toHaveBeenCalledWith(communityPublishedKey(USER_ID), VALID_ID);
    });

    it('rate limits by client IP', async () => {
      mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
      const res = await handle('GET');
      expect(res._status).toBe(429);
      expect(mocks.checkRateLimit).toHaveBeenCalledWith('203.0.113.1', 'community.read');
    });

    it('explains a hidden design to its owner with the hide reason and dominant report category', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      redis.hmget.mockResolvedValue(['0', '0', '0', '1', '2', 'reports']);
      redis.hgetall.mockResolvedValue({ spam: '3', inappropriate: '1' });
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(redis.hgetall).toHaveBeenCalledWith(communityReportReasonKey(VALID_ID));
      const body = res._body as { hiddenReason: string; hiddenReasonCategory: string };
      expect(body.hiddenReason).toBe('reports');
      expect(body.hiddenReasonCategory).toBe('spam');
    });

    it('surfaces a manual moderation hide distinctly for the owner', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      redis.hmget.mockResolvedValue(['0', '0', '0', '0', '0', 'moderation']);
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      const body = res._body as { hiddenReason: string };
      expect(body.hiddenReason).toBe('moderation');
    });

    it('marks a deny-list hide distinctly for the owner, with no report category', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      redis.hmget.mockResolvedValue(['0', '0', '0', '0', '0', 'denylist']);
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      const body = res._body as { hiddenReason: string; hiddenReasonCategory: string | null };
      expect(body.hiddenReason).toBe('denylist');
      expect(body.hiddenReasonCategory).toBeNull();
    });

    it('never sends hidden-reason fields on a live design', async () => {
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(res._body as object).not.toHaveProperty('hiddenReason');
      expect(res._body as object).not.toHaveProperty('hiddenReasonCategory');
    });

    it('counts a view once per hashed IP for a non-owner GET of a live design', async () => {
      const res = await handle('GET');
      expect(res._status).toBe(200);
      const viewedKey = communityViewedKey(VALID_ID, communityDedupeBucket(Date.now()));
      expect(redis.sadd).toHaveBeenCalledWith(viewedKey, expect.stringMatching(/^ip:/));
      expect(redis.expire).toHaveBeenCalledWith(viewedKey, COMMUNITY_DEDUPE_TTL_SECONDS);
      expect(redis.hincrby).toHaveBeenCalledWith(communityDesignKey(VALID_ID), 'views', 1);
    });

    it('does not recount a repeat view from the same IP', async () => {
      redis.sadd.mockResolvedValue(0);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(redis.hincrby).not.toHaveBeenCalled();
    });

    it('does not record a view for a lineage/publish-dialog fetch with ?view=0 (A15)', async () => {
      const res = await handle('GET', { query: { view: '0' } });
      expect(res._status).toBe(200);
      expect(redis.sadd).not.toHaveBeenCalled();
      expect(redis.hincrby).not.toHaveBeenCalled();
    });

    it('never counts the owner viewing their own design', async () => {
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(redis.sadd).not.toHaveBeenCalled();
      expect(redis.hincrby).not.toHaveBeenCalled();
    });

    it('still returns the detail when the view counter write fails', async () => {
      redis.sadd.mockRejectedValue(new Error('redis flaked'));
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { design: CommunityDesignRecord }).design.id).toBe(VALID_ID);
    });

    it('hides a design whose card hash says hidden even when the blob still says live', async () => {
      // Moderation flips (setCommunityDesignStatus) write the card hash only,
      // so the blob keeps its publish-time 'live'. The gate must trust the hash.
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'live' }));
      redis.hget.mockResolvedValue('hidden');
      const res = await handle('GET');
      expect(res._status).toBe(404);
      expect(redis.hget).toHaveBeenCalledWith(communityDesignKey(VALID_ID), 'status');
    });

    it('fails closed to hidden when the card hash has no readable status', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'live' }));
      redis.hget.mockResolvedValue(null);
      const res = await handle('GET');
      expect(res._status).toBe(404);
    });

    it('serves the hash-derived status to the owner of a card-hidden design', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'live' }));
      redis.hget.mockResolvedValue('hidden');
      mocks.readSessionCookie.mockReturnValue('session-token');
      mocks.readSession.mockResolvedValue(session);
      redis.sismember.mockResolvedValue(1);
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { design: CommunityDesignRecord }).design.status).toBe('hidden');
    });

    it('degrades to a clean 500 when the record read throws (e.g. TOKEN_SALT unset)', async () => {
      mocks.readCommunityDesignBlob.mockRejectedValue(
        new Error('TOKEN_SALT is required to derive community blob paths')
      );
      const res = await handle('GET');
      expect(res._status).toBe(500);
      expect((res._body as { code: string }).code).toBe('SERVER_ERROR');
    });
  });

  describe('PUT', () => {
    it('returns 503 when the publish kill switch is off, before touching the session', async () => {
      delete process.env.COMMUNITY_PUBLISH_ENABLED;
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(503);
      expect(mocks.requireSession).not.toHaveBeenCalled();
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    });

    it('returns a neutral 403 for a deny-listed user without writing anything', async () => {
      redis.sismember.mockImplementation((key: unknown) =>
        key === communityDenylistKey() ? 1 : 0
      );
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(403);
      expect((res._body as { error: string }).error.toLowerCase()).not.toContain('deny');
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    });

    it('rejects a caller whose published set does not contain the id', async () => {
      redis.sismember.mockResolvedValue(0);
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(404);
      expect(redis.sismember).toHaveBeenCalledWith(communityPublishedKey(USER_ID), VALID_ID);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    });

    it('requires a session', async () => {
      mocks.requireSession.mockImplementation((_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'Not signed in', code: 'UNAUTHORIZED' });
        return Promise.resolve(null);
      });
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(401);
      expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    });

    it('passes validation failures through as 400', async () => {
      mocks.validateCommunityPublish.mockReturnValue({
        valid: false,
        error: { code: 'INVALID_NAME', message: 'name must be 1-60 characters' },
      });
      const res = await handle('PUT', { body: { name: '' } });
      expect(res._status).toBe(400);
      expect(res._body).toEqual({ error: 'name must be 1-60 characters', code: 'INVALID_NAME' });
    });

    it('rejects updates to a hidden design without uploading new assets', async () => {
      redis.hget.mockResolvedValue('hidden');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'hidden' }));
      const res = await handle('PUT', { body: { ...publishPayload(), status: 'live' } });
      expect(res._status).toBe(403);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
      expect(mocks.writeCommunityCard).not.toHaveBeenCalled();
    });

    it('rejects updates to a removed design', async () => {
      redis.hget.mockResolvedValue('removed');
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'removed' }));
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(403);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it('rejects updates when the card hash says hidden even though the blob says live', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ status: 'live' }));
      redis.hget.mockResolvedValue('hidden');
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(403);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    });

    it('consumes the manage budget, not the publish budget, and never consults quota', async () => {
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(200);
      expect(mocks.checkRateLimit).toHaveBeenCalledWith(USER_ID, 'community.manage');
      // A user at the live-design cap must still be able to edit: updates
      // never grow the published set, so quota must stay out of this path.
      expect(mocks.checkCommunityPublishQuota).not.toHaveBeenCalled();
    });

    it('degrades to a clean 500 when the record read throws (e.g. TOKEN_SALT unset)', async () => {
      mocks.readCommunityDesignBlob.mockRejectedValue(
        new Error('TOKEN_SALT is required to derive community blob paths')
      );
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(500);
      expect((res._body as { code: string }).code).toBe('SERVER_ERROR');
    });

    it('rewrites assets under a bumped rev and deletes the replaced ones', async () => {
      const existing = designRecord();
      mocks.readCommunityDesignBlob.mockResolvedValue(existing);
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(200);

      const putPaths = mocks.put.mock.calls.map((call) => call[0] as string);
      expect(putPaths).toEqual([
        communityThumbBlobPath(VALID_ID, 4, 0),
        communityThumbBlobPath(VALID_ID, 4, 1),
        communityMeshBlobPath(VALID_ID, 4),
      ]);

      const design = (res._body as { design: CommunityDesignRecord }).design;
      expect(design.meshUrl).toBe(`https://blob.example/${communityMeshBlobPath(VALID_ID, 4)}`);
      expect(design.thumbnails).toEqual([
        `https://blob.example/${communityThumbBlobPath(VALID_ID, 4, 0)}`,
        `https://blob.example/${communityThumbBlobPath(VALID_ID, 4, 1)}`,
      ]);

      expect(mocks.del).toHaveBeenCalledWith([...existing.thumbnails, existing.meshUrl]);
      expect(mocks.writeCommunityDesignBlob).toHaveBeenCalledWith(design, {
        allowOverwrite: true,
      });
    });

    it('preserves identity and lineage while updating content in place', async () => {
      const lineage = {
        parentId: PARENT_ID,
        rootId: PARENT_ID,
        parentName: 'Parent bin',
        parentAuthorName: 'Ada',
        rootAuthorName: 'Ada',
      };
      mocks.readCommunityDesignBlob.mockResolvedValue(designRecord({ lineage, featured: true }));
      const res = await handle('PUT', { body: publishPayload() });
      const design = (res._body as { design: CommunityDesignRecord }).design;
      expect(design.id).toBe(VALID_ID);
      expect(design.authorPublicId).toBe('author-public-id');
      expect(design.lineage).toEqual(lineage);
      expect(design.featured).toBe(true);
      expect(design.createdAt).toBe(1000);
      expect(design.updatedAt).toBeGreaterThan(1000);
      expect(design.name).toBe('Updated bin');
      // Millimetres, exactly like publish: 4u x 42 - 0.5, 2u x 42 - 0.5, 9u x 7.
      expect(design.metrics).toEqual({ width: 167.5, depth: 83.5, height: 63, gridUnitMm: 42 });
    });

    it('refreshes the publish-idempotency content hash', async () => {
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(200);
      const hsetCalls = redis.hset.mock.calls as Array<[string, Record<string, string>]>;
      const hashCall = hsetCalls.find(([, fields]) => fields.contentHash !== undefined);
      expect(hashCall?.[0]).toBe(communityDesignKey(VALID_ID));
      expect(hashCall?.[1].contentHash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('deletes every orphaned thumbnail when the update ships fewer of them', async () => {
      const existing = designRecord({
        thumbnails: [
          `https://blob.example/community/thumbs/${VALID_ID}-3-0.webp`,
          `https://blob.example/community/thumbs/${VALID_ID}-3-1.webp`,
          `https://blob.example/community/thumbs/${VALID_ID}-3-2.webp`,
        ],
      });
      mocks.readCommunityDesignBlob.mockResolvedValue(existing);
      mocks.validateCommunityPublish.mockReturnValue({
        valid: true,
        payload: publishPayload({ thumbnails: ['dGh1bWItMA=='] }),
      });

      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(200);
      expect(mocks.del).toHaveBeenCalledWith([...existing.thumbnails, existing.meshUrl]);
    });

    it('still returns the updated record when stale-asset cleanup fails', async () => {
      mocks.del.mockRejectedValue(new Error('blob store flaked'));
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(200);
      expect((res._body as { design: CommunityDesignRecord }).design.name).toBe('Updated bin');
    });

    it('preserves a hide that lands during the update instead of resurrecting to live (A4)', async () => {
      // First status read (admission gate) sees live; the re-read just before
      // the card write sees the hide that landed during asset upload.
      redis.hget.mockResolvedValueOnce('live').mockResolvedValueOnce('hidden');
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(200);
      expect(mocks.writeCommunityCard).toHaveBeenCalledWith(
        redis,
        expect.objectContaining({ status: 'hidden' })
      );
    });

    it('rejects an update that makes a remix identical to its parent (B4)', async () => {
      mocks.readCommunityDesignBlob
        .mockResolvedValueOnce(
          designRecord({
            lineage: {
              parentId: PARENT_ID,
              rootId: PARENT_ID,
              parentName: 'P',
              parentAuthorName: 'PA',
              rootAuthorName: 'PA',
            },
          })
        )
        .mockResolvedValueOnce(
          designRecord({
            id: PARENT_ID,
            params: publishPayload().params,
          })
        );
      const res = await handle('PUT', { body: publishPayload() });
      expect(res._status).toBe(409);
      expect((res._body as { code: string }).code).toBe('REMIX_UNCHANGED');
    });
  });

  describe('DELETE', () => {
    it('owner unpublish cleans blobs and every Redis membership', async () => {
      const record = designRecord({
        lineage: {
          parentId: PARENT_ID,
          rootId: PARENT_ID,
          parentName: 'Parent bin',
          parentAuthorName: 'Ada',
          rootAuthorName: 'Ada',
        },
      });
      mocks.readCommunityDesignBlob.mockResolvedValue(record);
      redis.smembers.mockResolvedValue(['liker-1', 'liker-2']);

      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ success: true });

      expect(mocks.del).toHaveBeenCalledWith([...record.thumbnails, record.meshUrl]);
      expect(mocks.deleteCommunityDesignBlob).toHaveBeenCalledWith(VALID_ID);
      expect(mocks.removeFromCommunityIndexes).toHaveBeenCalledWith(redis, VALID_ID);
      expect(pipeline.del).toHaveBeenCalledWith(
        communityDesignKey(VALID_ID),
        communityLikesKey(VALID_ID),
        communityReportsKey(VALID_ID),
        communityReportReasonKey(VALID_ID),
        communityChildrenKey(VALID_ID)
      );
      const sremCalls = pipeline.srem.mock.calls;
      expect(sremCalls).toContainEqual([communityAuthorKey('author-public-id'), VALID_ID]);
      expect(sremCalls).toContainEqual([communityPublishedKey(USER_ID), VALID_ID]);
      expect(sremCalls).toContainEqual([communityChildrenKey(PARENT_ID), VALID_ID]);
      expect(sremCalls).toContainEqual([communityLikedKey('liker-1'), VALID_ID]);
      expect(sremCalls).toContainEqual([communityLikedKey('liker-2'), VALID_ID]);
    });

    it('rejects a caller whose published set does not contain the id', async () => {
      redis.sismember.mockResolvedValue(0);
      const res = await handle('DELETE');
      expect(res._status).toBe(404);
      expect(mocks.del).not.toHaveBeenCalled();
      expect(mocks.deleteCommunityDesignBlob).not.toHaveBeenCalled();
      expect(pipeline.exec).not.toHaveBeenCalled();
    });

    it('admin token purges without a session and without a published-set entry', async () => {
      process.env.COMMUNITY_ADMIN_TOKEN = 'admin-secret';
      const res = await handle('DELETE', { headers: { 'x-admin-token': 'admin-secret' } });
      expect(res._status).toBe(200);
      expect(mocks.requireSession).not.toHaveBeenCalled();
      expect(mocks.deleteCommunityDesignBlob).toHaveBeenCalledWith(VALID_ID);
      const sremKeys = pipeline.srem.mock.calls.map((call) => call[0] as string);
      expect(sremKeys.some((key) => key.startsWith('community:published:'))).toBe(false);
    });

    it('rejects a wrong admin token without deleting anything', async () => {
      process.env.COMMUNITY_ADMIN_TOKEN = 'admin-secret';
      const res = await handle('DELETE', { headers: { 'x-admin-token': 'wrong-secret' } });
      expect(res._status).toBe(401);
      expect(mocks.requireSession).not.toHaveBeenCalled();
      expect(mocks.del).not.toHaveBeenCalled();
      expect(mocks.deleteCommunityDesignBlob).not.toHaveBeenCalled();
      expect(pipeline.exec).not.toHaveBeenCalled();
    });

    it('falls back to owner authorization when COMMUNITY_ADMIN_TOKEN is unset', async () => {
      const res = await handle('DELETE', { headers: { 'x-admin-token': 'anything' } });
      expect(res._status).toBe(200);
      expect(mocks.requireSession).toHaveBeenCalledTimes(1);
      const sremCalls = pipeline.srem.mock.calls;
      expect(sremCalls).toContainEqual([communityPublishedKey(USER_ID), VALID_ID]);
    });

    it('uses owner authorization when the admin token is configured but no header is sent', async () => {
      process.env.COMMUNITY_ADMIN_TOKEN = 'admin-secret';
      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      expect(mocks.requireSession).toHaveBeenCalledTimes(1);
      const sremCalls = pipeline.srem.mock.calls;
      expect(sremCalls).toContainEqual([communityPublishedKey(USER_ID), VALID_ID]);
    });

    it('rate limits owner deletes on the manage budget, not the publish budget', async () => {
      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      expect(mocks.checkRateLimit).toHaveBeenCalledWith(USER_ID, 'community.manage');
    });

    it('rate limits admin purges per IP on the manage budget', async () => {
      process.env.COMMUNITY_ADMIN_TOKEN = 'admin-secret';
      const res = await handle('DELETE', { headers: { 'x-admin-token': 'admin-secret' } });
      expect(res._status).toBe(200);
      expect(mocks.checkRateLimit).toHaveBeenCalledWith('203.0.113.1', 'community.manage');
    });

    it('degrades to a clean 500 when the record read throws (e.g. TOKEN_SALT unset)', async () => {
      mocks.readCommunityDesignBlob.mockRejectedValue(
        new Error('TOKEN_SALT is required to derive community blob paths')
      );
      const res = await handle('DELETE');
      expect(res._status).toBe(500);
      expect((res._body as { code: string }).code).toBe('SERVER_ERROR');
    });

    it('returns 404 when neither the record nor its card hash exists', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(null);
      redis.hgetall.mockResolvedValue({});
      const res = await handle('DELETE');
      expect(res._status).toBe(404);
      expect(pipeline.exec).not.toHaveBeenCalled();
    });

    it('finishes cleaning Redis state when only the card hash remains', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(null);
      redis.hgetall.mockResolvedValue({ id: VALID_ID, authorPublicId: 'author-public-id' });
      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      expect(mocks.del).not.toHaveBeenCalled();
      expect(mocks.deleteCommunityDesignBlob).not.toHaveBeenCalled();
      const sremCalls = pipeline.srem.mock.calls;
      expect(sremCalls).toContainEqual([communityAuthorKey('author-public-id'), VALID_ID]);
      expect(sremCalls).toContainEqual([communityPublishedKey(USER_ID), VALID_ID]);
    });

    it('removes the child from its parent children set on a card-hash-only retry', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(null);
      redis.hgetall.mockResolvedValue({
        id: VALID_ID,
        authorPublicId: 'author-public-id',
        parentId: 'parentabc123',
      });
      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      expect(pipeline.srem.mock.calls).toContainEqual([
        communityChildrenKey('parentabc123'),
        VALID_ID,
      ]);
    });

    it('rejects an owner unpublish of a moderated (hidden) design (A2)', async () => {
      redis.hget.mockImplementation((_key: string, field: string) =>
        field === 'status' ? 'hidden' : null
      );
      const res = await handle('DELETE');
      expect(res._status).toBe(409);
      expect((res._body as { code: string }).code).toBe('UNDER_REVIEW');
      expect(mocks.del).not.toHaveBeenCalled();
      expect(mocks.deleteCommunityDesignBlob).not.toHaveBeenCalled();
      expect(pipeline.exec).not.toHaveBeenCalled();
    });

    it('lets an admin purge a hidden design despite the owner gate (A2)', async () => {
      process.env.COMMUNITY_ADMIN_TOKEN = 'admin-secret';
      redis.hget.mockImplementation((_key: string, field: string) =>
        field === 'status' ? 'hidden' : null
      );
      const res = await handle('DELETE', { headers: { 'x-admin-token': 'admin-secret' } });
      expect(res._status).toBe(200);
      expect(mocks.deleteCommunityDesignBlob).toHaveBeenCalledWith(VALID_ID);
    });

    it("clears each reporter's reverse reported set before deleting the reports set (A15)", async () => {
      redis.smembers.mockImplementation((key: string) =>
        key === communityReportsKey(VALID_ID) ? ['reporter-1', 'reporter-2'] : []
      );
      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      const sremCalls = pipeline.srem.mock.calls;
      expect(sremCalls).toContainEqual([communityReportedKey('reporter-1'), VALID_ID]);
      expect(sremCalls).toContainEqual([communityReportedKey('reporter-2'), VALID_ID]);
    });

    it('returns remix credit to the parent and root when a remix is deleted (A1)', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(
        designRecord({
          lineage: {
            parentId: PARENT_ID,
            rootId: 'RootDesign01',
            parentName: 'P',
            parentAuthorName: 'PA',
            rootAuthorName: 'RA',
          },
        })
      );
      const res = await handle('DELETE');
      expect(res._status).toBe(200);
      expect(redis.hincrby).toHaveBeenCalledWith(communityDesignKey(PARENT_ID), 'remixes', -1);
      expect(redis.hincrby).toHaveBeenCalledWith(communityDesignKey('RootDesign01'), 'remixes', -1);
    });
  });

  describe('POST actions', () => {
    const CLIENT_ID = 'client-0123456789abcdef';
    const ROOT_ID = 'RootDesign12';

    function withSessionRejected() {
      mocks.requireSession.mockImplementation((_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'Not signed in', code: 'UNAUTHORIZED' });
        return Promise.resolve(null);
      });
    }

    describe('dispatcher', () => {
      it('rejects a body without an action', async () => {
        const res = await handle('POST', { body: {} });
        expect(res._status).toBe(400);
        expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
      });

      it('rejects an unknown action', async () => {
        const res = await handle('POST', { body: { action: 'boost' } });
        expect(res._status).toBe(400);
        expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
      });
    });

    describe('setCover (owner cover promotion)', () => {
      const PHOTO = 'https://blob.example/community/prints/a.webp';

      function livePrintWith(photos: string[]) {
        return [{ status: 'live', photos, designId: VALID_ID, authorPublicId: 'a'.repeat(32) }];
      }

      beforeEach(() => {
        vi.stubEnv('COMMUNITY_PRINTS_ENABLED', 'true');
        redis.zrange.mockResolvedValue(['a'.repeat(32)]);
        printStoreMocks.readCommunityPrints.mockResolvedValue(livePrintWith([PHOTO]));
      });

      it('503s while the prints kill switch is off', async () => {
        vi.stubEnv('COMMUNITY_PRINTS_ENABLED', 'false');
        const res = await handle('POST', { body: { action: 'setCover', photoUrl: PHOTO } });
        // Promotion is part of the prints feature: an owner must not be able
        // to push an unreviewed photo onto the grid while prints are dark.
        expect(res._status).toBe(503);
      });

      it('requires a session', async () => {
        withSessionRejected();
        const res = await handle('POST', { body: { action: 'setCover', photoUrl: PHOTO } });
        expect(res._status).toBe(401);
      });

      it('404s for a caller who does not own the design', async () => {
        // Not deny-listed, but not in the published set either: not the owner.
        redis.sismember.mockResolvedValue(0);
        const res = await handle('POST', { body: { action: 'setCover', photoUrl: PHOTO } });
        expect(res._status).toBe(404);
      });

      it('promotes a photo that belongs to a live print of this design', async () => {
        const res = await handle('POST', { body: { action: 'setCover', photoUrl: PHOTO } });

        expect(res._status).toBe(200);
        expect(res._body).toEqual({ coverPhotoUrl: PHOTO });
        expect(redis.hset).toHaveBeenCalledWith(
          communityDesignKey(VALID_ID),
          expect.objectContaining({ coverPhotoUrl: PHOTO })
        );
      });

      it('rejects a URL that is not on any print of this design', async () => {
        // Without this the field would accept any URL, which is the entire
        // risk owner opt-in exists to contain.
        const res = await handle('POST', {
          body: { action: 'setCover', photoUrl: 'https://blob.example/somebody-else.webp' },
        });

        expect(res._status).toBe(400);
        expect(redis.hset).not.toHaveBeenCalledWith(
          communityDesignKey(VALID_ID),
          expect.objectContaining({ coverPhotoUrl: expect.anything() })
        );
      });

      it('refuses a photo from a hidden print', async () => {
        printStoreMocks.readCommunityPrints.mockResolvedValue([
          { status: 'hidden', photos: [PHOTO], designId: VALID_ID, authorPublicId: 'a'.repeat(32) },
        ]);

        const res = await handle('POST', { body: { action: 'setCover', photoUrl: PHOTO } });

        // A moderated print must not be promotable back onto the grid.
        expect(res._status).toBe(400);
      });

      it('clears the cover back to the render', async () => {
        const res = await handle('POST', { body: { action: 'setCover', photoUrl: null } });

        expect(res._status).toBe(200);
        expect(res._body).toEqual({ coverPhotoUrl: '' });
        expect(printStoreMocks.readCommunityPrints).not.toHaveBeenCalled();
      });

      it('rejects a non-string, non-null photoUrl', async () => {
        const res = await handle('POST', { body: { action: 'setCover', photoUrl: 42 } });
        expect(res._status).toBe(400);
      });
    });

    describe('like/unlike', () => {
      it('rejects an anonymous like without touching the toggle', async () => {
        withSessionRejected();
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(401);
        expect(mocks.toggleCommunityLike).not.toHaveBeenCalled();
      });

      it('likes via the atomic toggle and returns { likes, likedByMe }', async () => {
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ likes: 13, likedByMe: true });
        expect(mocks.checkRateLimit).toHaveBeenCalledWith(USER_ID, 'community.like');
        expect(mocks.toggleCommunityLike).toHaveBeenCalledWith(redis, USER_ID, VALID_ID, true);
      });

      it('unlikes via the same toggle with likedByMe false', async () => {
        const res = await handle('POST', { body: { action: 'unlike' } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ likes: 13, likedByMe: false });
        expect(mocks.toggleCommunityLike).toHaveBeenCalledWith(redis, USER_ID, VALID_ID, false);
      });

      it('404s a like on a hidden design without toggling', async () => {
        redis.hget.mockResolvedValue('hidden');
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(404);
        expect(mocks.toggleCommunityLike).not.toHaveBeenCalled();
      });

      it('404s a like on a never-published design (missing card hash)', async () => {
        redis.hget.mockResolvedValue(null);
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(404);
        expect(mocks.toggleCommunityLike).not.toHaveBeenCalled();
      });

      it('rate limits likes on the community.like budget', async () => {
        mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(429);
        expect(mocks.checkRateLimit).toHaveBeenCalledWith(USER_ID, 'community.like');
      });

      it('works with the publish kill switch off (actions are not publishing)', async () => {
        delete process.env.COMMUNITY_PUBLISH_ENABLED;
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ likes: 13, likedByMe: true });
      });

      it('rejects a like from a deny-listed account (A3)', async () => {
        redis.sismember.mockResolvedValue(1);
        const res = await handle('POST', { body: { action: 'like' } });
        expect(res._status).toBe(403);
        expect((res._body as { code: string }).code).toBe('UNAUTHORIZED');
        expect(mocks.toggleCommunityLike).not.toHaveBeenCalled();
      });

      it('allows an unlike on a hidden design (A15 withdrawal always works)', async () => {
        redis.hget.mockImplementation((_key: string, field: string) =>
          field === 'status' ? 'hidden' : null
        );
        const res = await handle('POST', { body: { action: 'unlike' } });
        expect(res._status).toBe(200);
        expect(mocks.toggleCommunityLike).toHaveBeenCalledWith(redis, USER_ID, VALID_ID, false);
      });

      // The toggle reads `likes` off the card hash whatever the status, so a
      // hidden design answered {likes: 13} where a deleted one answers
      // {likes: 0} — a 200-vs-200 oracle confirming a takedown and leaking the
      // pre-takedown count to anyone who kept the id.
      it('answers an unlike on a hidden design exactly as a missing one', async () => {
        redis.hget.mockImplementation((_key: string, field: string) =>
          field === 'status' ? 'hidden' : null
        );
        const hidden = await handle('POST', { body: { action: 'unlike' } });

        redis.hget.mockResolvedValue(null);
        const missing = await handle('POST', { body: { action: 'unlike' } });

        expect(hidden._status).toBe(missing._status);
        expect(hidden._body).toEqual(missing._body);
        expect(hidden._body).toEqual({ likes: 0, likedByMe: false });
      });

      it('still clears the heart on a hidden design despite the neutral body', async () => {
        redis.hget.mockImplementation((_key: string, field: string) =>
          field === 'status' ? 'hidden' : null
        );
        await handle('POST', { body: { action: 'unlike' } });
        expect(mocks.toggleCommunityLike).toHaveBeenCalledWith(redis, USER_ID, VALID_ID, false);
      });
    });

    describe('report', () => {
      const reportBody = { action: 'report', reason: 'spam' };

      it('requires a session', async () => {
        withSessionRejected();
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(401);
        expect(pipeline.exec).not.toHaveBeenCalled();
      });

      it('rejects an unknown reason before touching Redis', async () => {
        const res = await handle('POST', { body: { action: 'report', reason: 'ugly' } });
        expect(res._status).toBe(400);
        expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
        expect(mocks.getRedis).not.toHaveBeenCalled();
      });

      it('rejects a note that fails the content filter', async () => {
        const res = await handle('POST', {
          body: { action: 'report', reason: 'spam', note: 'see <script here' },
        });
        expect(res._status).toBe(400);
        expect((res._body as { code: string }).code).toBe('CONTENT_BLOCKED');
        expect(pipeline.exec).not.toHaveBeenCalled();
      });

      it('404s a report on a non-live design', async () => {
        redis.hget.mockResolvedValue('removed');
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(404);
        expect(pipeline.exec).not.toHaveBeenCalled();
      });

      it('records the report in both the design set and the reverse index', async () => {
        redis.scard.mockResolvedValue(2);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, autoHidden: false });
        expect(mocks.checkRateLimit).toHaveBeenCalledWith(USER_ID, 'community.report');
        expect(pipeline.sadd.mock.calls).toContainEqual([communityReportsKey(VALID_ID), USER_ID]);
        expect(pipeline.sadd.mock.calls).toContainEqual([communityReportedKey(USER_ID), VALID_ID]);
        expect(mocks.setCommunityDesignStatus).not.toHaveBeenCalled();
        expect(mocks.del).not.toHaveBeenCalled();
      });

      it('tallies the reason once per new reporter for the owner-facing aggregate', async () => {
        redis.scard.mockResolvedValue(2);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(200);
        expect(redis.hincrby).toHaveBeenCalledWith(communityReportReasonKey(VALID_ID), 'spam', 1);
      });

      it('does not tally the reason for a repeat reporter', async () => {
        pipeline.exec.mockResolvedValue([
          [null, 0],
          [null, 1],
        ]);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(200);
        expect(redis.hincrby).not.toHaveBeenCalled();
      });

      it('dedupes a repeat report from the same account (no threshold re-check)', async () => {
        pipeline.exec.mockResolvedValue([
          [null, 0],
          [null, 1],
        ]);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, autoHidden: false });
        expect(redis.scard).not.toHaveBeenCalled();
        expect(mocks.setCommunityDesignStatus).not.toHaveBeenCalled();
        expect(mocks.del).not.toHaveBeenCalled();
      });

      it('auto-hides at the distinct-account threshold WITHOUT deleting assets (reversible soft-hide)', async () => {
        const record = designRecord();
        mocks.readCommunityDesignBlob.mockResolvedValue(record);
        redis.scard.mockResolvedValue(5);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, autoHidden: true });
        expect(mocks.setCommunityDesignStatus).toHaveBeenCalledWith(redis, VALID_ID, 'hidden');
        expect(redis.hset).toHaveBeenCalledWith(communityDesignKey(VALID_ID), {
          hiddenReason: 'reports',
        });
        // A report threshold is a signal, not a verdict: assets stay intact so
        // an admin restore brings the design back whole. Asset deletion is the
        // admin takedown path's job, not auto-hide's.
        expect(mocks.del).not.toHaveBeenCalled();
        expect(redis.hset).not.toHaveBeenCalledWith(communityDesignKey(VALID_ID), {
          purgePending: '1',
        });
      });

      // The hide has to outlive this design id: DELETE and PUT block a
      // moderation reset, but a re-publish of the identical payload used to
      // mint a fresh live design with an empty reports set, because both the
      // idempotency and duplicate checks only match LIVE designs.
      it('tombstones the content hash so a re-publish cannot reset moderation', async () => {
        mocks.readCommunityDesignBlob.mockResolvedValue(designRecord());
        redis.scard.mockResolvedValue(5);
        redis.hget.mockImplementation((_key: string, field: string) =>
          field === 'contentHash' ? 'c'.repeat(32) : 'live'
        );

        const res = await handle('POST', { body: reportBody });

        expect((res._body as { autoHidden: boolean }).autoHidden).toBe(true);
        expect(redis.sadd).toHaveBeenCalledWith(communityModeratedContentKey(), 'c'.repeat(32));
      });

      it('does not tombstone below the threshold', async () => {
        redis.scard.mockResolvedValue(4);
        redis.hget.mockImplementation((_key: string, field: string) =>
          field === 'contentHash' ? 'c'.repeat(32) : 'live'
        );

        await handle('POST', { body: reportBody });

        expect(redis.sadd).not.toHaveBeenCalledWith(
          communityModeratedContentKey(),
          expect.anything()
        );
      });

      it('works with the publish kill switch off', async () => {
        delete process.env.COMMUNITY_PUBLISH_ENABLED;
        redis.scard.mockResolvedValue(1);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, autoHidden: false });
      });

      it('rejects a report from a deny-listed account (A3)', async () => {
        redis.sismember.mockResolvedValue(1);
        const res = await handle('POST', { body: reportBody });
        expect(res._status).toBe(403);
        expect((res._body as { code: string }).code).toBe('UNAUTHORIZED');
        expect(pipeline.exec).not.toHaveBeenCalled();
      });
    });

    describe('open/export', () => {
      const CLIENT_MEMBER = `c:${CLIENT_ID}`;
      const IP_MEMBER = `ip:${createHash('sha256').update('203.0.113.1').digest('hex').slice(0, 16)}`;
      const openedKey = () => communityOpenedKey(VALID_ID, communityDedupeBucket(Date.now()));
      const exportedKey = () => communityExportedKey(VALID_ID, communityDedupeBucket(Date.now()));

      it('never consults the session', async () => {
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(mocks.requireSession).not.toHaveBeenCalled();
      });

      it('rate limits by client IP on the community.action budget', async () => {
        mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
        const res = await handle('POST', { body: { action: 'export', clientId: CLIENT_ID } });
        expect(res._status).toBe(429);
        expect(mocks.checkRateLimit).toHaveBeenCalledWith('203.0.113.1', 'community.action');
      });

      it.each([
        ['missing', undefined],
        ['too short', 'shortid'],
        ['bad charset', 'client!0123456789abcdef'],
        ['too long', 'x'.repeat(65)],
      ])('rejects a %s clientId before touching Redis', async (_label, clientId) => {
        const res = await handle('POST', { body: { action: 'open', clientId } });
        expect(res._status).toBe(400);
        expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
        expect(mocks.getRedis).not.toHaveBeenCalled();
      });

      it('404s on a non-live design', async () => {
        redis.hget.mockResolvedValue(null);
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(404);
        expect(redis.hincrby).not.toHaveBeenCalled();
      });

      it('open counts once per new clientId + IP with a bucketed, TTLd dedupe set', async () => {
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true });
        expect(redis.sadd.mock.calls).toEqual([[openedKey(), IP_MEMBER]]);
        expect(pipeline.sadd.mock.calls).toEqual([[openedKey(), CLIENT_MEMBER]]);
        expect(pipeline.expire).toHaveBeenCalledWith(openedKey(), COMMUNITY_DEDUPE_TTL_SECONDS);
        expect(redis.hincrby).toHaveBeenCalledTimes(1);
        expect(redis.hincrby).toHaveBeenCalledWith(communityDesignKey(VALID_ID), 'opens', 1);
      });

      it('open dedupes a repeat clientId without incrementing', async () => {
        pipeline.exec.mockResolvedValue([
          [null, 0],
          [null, 1],
        ]);
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true });
        expect(redis.hincrby).not.toHaveBeenCalled();
      });

      it('open never counts nor stores a fresh clientId from an already-counted IP', async () => {
        // The rotation attack: a bot minting a new clientId per request. The
        // IP member SADDs as already present, so no count, and the minted
        // clientId is never written: otherwise one IP at the rate limit could
        // fill the set to the cardinality ceiling and freeze counting for the
        // rest of the window (counter-freeze DoS on a targeted design).
        redis.sadd.mockResolvedValue(0);
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true });
        expect(pipeline.sadd).not.toHaveBeenCalled();
        expect(redis.hincrby).not.toHaveBeenCalled();
      });

      it('stops growing and counting past the dedupe cardinality ceiling', async () => {
        redis.scard.mockResolvedValue(20_000);
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true });
        expect(redis.sadd).not.toHaveBeenCalled();
        expect(pipeline.sadd).not.toHaveBeenCalled();
        expect(redis.hincrby).not.toHaveBeenCalled();
      });

      it('export increments and echoes the design counter for a lineage-free design', async () => {
        redis.hincrby.mockResolvedValue(8);
        const res = await handle('POST', { body: { action: 'export', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, exports: 8 });
        expect(redis.sadd.mock.calls).toEqual([[exportedKey(), IP_MEMBER]]);
        expect(pipeline.sadd.mock.calls).toEqual([[exportedKey(), CLIENT_MEMBER]]);
        expect(redis.hincrby).toHaveBeenCalledTimes(1);
        expect(redis.hincrby).toHaveBeenCalledWith(communityDesignKey(VALID_ID), 'exports', 1);
      });

      it('export dedupes a repeat clientId and echoes the stored count', async () => {
        pipeline.exec.mockResolvedValue([
          [null, 0],
          [null, 1],
        ]);
        // First hget answers the live gate, second answers the exports echo.
        redis.hget.mockResolvedValueOnce('live').mockResolvedValueOnce('7');
        const res = await handle('POST', { body: { action: 'export', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, exports: 7 });
        expect(redis.hincrby).not.toHaveBeenCalled();
      });

      it('export credits the parent AND the root from the blob lineage', async () => {
        mocks.readCommunityDesignBlob.mockResolvedValue(
          designRecord({
            lineage: {
              parentId: PARENT_ID,
              rootId: ROOT_ID,
              parentName: 'Parent bin',
              parentAuthorName: 'Ada',
              rootAuthorName: 'Root Rita',
            },
          })
        );
        const res = await handle('POST', { body: { action: 'export', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(redis.hincrby.mock.calls).toEqual([
          [communityDesignKey(VALID_ID), 'exports', 1],
          [communityDesignKey(PARENT_ID), 'exports', 1],
          [communityDesignKey(ROOT_ID), 'exports', 1],
        ]);
      });

      it('export credits a direct remix of the root once, not twice', async () => {
        mocks.readCommunityDesignBlob.mockResolvedValue(
          designRecord({
            lineage: {
              parentId: PARENT_ID,
              rootId: PARENT_ID,
              parentName: 'Parent bin',
              parentAuthorName: 'Ada',
              rootAuthorName: 'Ada',
            },
          })
        );
        const res = await handle('POST', { body: { action: 'export', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(redis.hincrby.mock.calls).toEqual([
          [communityDesignKey(VALID_ID), 'exports', 1],
          [communityDesignKey(PARENT_ID), 'exports', 1],
        ]);
      });

      it('export never resurrects a deleted ancestor hash', async () => {
        mocks.readCommunityDesignBlob.mockResolvedValue(
          designRecord({
            lineage: {
              parentId: PARENT_ID,
              rootId: ROOT_ID,
              parentName: 'Parent bin',
              parentAuthorName: 'Ada',
              rootAuthorName: 'Root Rita',
            },
          })
        );
        redis.exists.mockResolvedValue(0);
        const res = await handle('POST', { body: { action: 'export', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
        expect(redis.hincrby.mock.calls).toEqual([[communityDesignKey(VALID_ID), 'exports', 1]]);
      });

      it('works with the publish kill switch off', async () => {
        delete process.env.COMMUNITY_PUBLISH_ENABLED;
        const res = await handle('POST', { body: { action: 'open', clientId: CLIENT_ID } });
        expect(res._status).toBe(200);
      });
    });
  });
});
