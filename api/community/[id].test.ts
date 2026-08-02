/**
 * Tests for community design GET/PUT/DELETE. The load-bearing invariants:
 *  - hidden/removed designs are indistinguishable from missing ones for
 *    everyone but their owner
 *  - PUT/DELETE authorize via the server-side published set, never a
 *    client-sent publishedId, and PUT can never change moderation status
 *  - PUT rewrites assets under a bumped rev and deletes the replaced rev
 *  - DELETE cleans blobs plus every Redis membership; the admin path needs
 *    a constant-time token match and is disabled without the env var
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { communityMeshBlobPath, communityThumbBlobPath } from '../lib/communityStore.js';
import type { CommunityDesignRecord } from '../lib/communityStore.js';
import type { SessionRecord } from '../lib/session.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityLikedKey,
  communityLikesKey,
  communityPublishedKey,
  communityReportsKey,
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

vi.mock('../lib/communityValidation.js', () => ({
  validateCommunityPublish: mocks.validateCommunityPublish,
}));

vi.mock('../lib/communityQuota.js', () => ({
  checkCommunityPublishQuota: mocks.checkCommunityPublishQuota,
}));

vi.mock('../lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readCommunityDesignBlob: mocks.readCommunityDesignBlob,
    writeCommunityDesignBlob: mocks.writeCommunityDesignBlob,
    writeCommunityCard: mocks.writeCommunityCard,
    removeFromCommunityIndexes: mocks.removeFromCommunityIndexes,
    deleteCommunityDesignBlob: mocks.deleteCommunityDesignBlob,
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
  exec: ReturnType<typeof vi.fn>;
}

interface FakeRedis {
  sismember: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  hget: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
  hset: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
}

function createRedis(): { redis: FakeRedis; pipeline: FakePipeline } {
  const pipeline: FakePipeline = {
    del: vi.fn(() => pipeline),
    srem: vi.fn(() => pipeline),
    exec: vi.fn(async () => [] as [null, unknown][]),
  };
  const redis: FakeRedis = {
    sismember: vi.fn(async (key: string) => (key === communityDenylistKey() ? 0 : 1)),
    smembers: vi.fn(async () => [] as string[]),
    hget: vi.fn(async (_key: string, field: string) => (field === 'status' ? 'live' : null)),
    hgetall: vi.fn(async (): Promise<Record<string, string>> => ({})),
    hset: vi.fn(async () => 1),
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
    params: { width: 4, depth: 2, height: 9, gridUnitMm: 42 },
    techniques: ['scoop'],
    thumbnails: ['dGh1bWItMA==', 'dGh1bWItMQ=='],
    glb: 'Z2xURgAAAAA=',
    ...overrides,
  };
}

async function handle(
  method: string,
  over: { id?: unknown; body?: unknown; headers?: Record<string, string> } = {}
) {
  const res = createResponse();
  const mod = await import('./[id].js');
  await mod.default(
    {
      method,
      query: { id: over.id ?? VALID_ID },
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
      const res = await handle('POST');
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

    it('returns 404 when the design does not exist', async () => {
      mocks.readCommunityDesignBlob.mockResolvedValue(null);
      const res = await handle('GET');
      expect(res._status).toBe(404);
      expect(res._body).toEqual({ error: 'Design not found', code: 'NOT_FOUND' });
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
  });
});
