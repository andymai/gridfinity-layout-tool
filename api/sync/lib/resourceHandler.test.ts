/**
 * Tests for the shared GET/PUT/DELETE skeleton behind all four sync
 * resources. Driven through a minimal fake resource config rather than one
 * of the real endpoints, so the LWW/tombstone/quota/blob-write-pair
 * mechanics are exercised directly instead of transitively.
 *
 * Mocks happen at: rateLimit (Redis + checkRateLimit), session
 * (requireSession), blobStore (putJson/getJson/deleteBlob) — same style as
 * api/sync/layouts/[id].test.ts. userIndex / quota run against the same
 * in-memory Redis, exercising the full state-write path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ErrorCode } from '../../lib/shared';
import { createSyncResourceHandler, type SyncResourceConfig } from './resourceHandler';

let redisStore: Map<string, string>;
let redisHashes: Map<string, Map<string, string>>;

const blobStore = new Map<string, unknown>();

const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  hget: vi.fn(async (k: string, f: string) => redisHashes.get(k)?.get(f) ?? null),
  hset: vi.fn(async (k: string, f: string, v: string) => {
    const h = redisHashes.get(k) ?? new Map<string, string>();
    h.set(f, v);
    redisHashes.set(k, h);
    return 1;
  }),
  hgetall: vi.fn(async (k: string) => {
    const h = redisHashes.get(k);
    return h ? Object.fromEntries(h) : {};
  }),
  pipeline: vi.fn(() => makePipeline()),
};

function makePipeline() {
  const queue: Array<() => [Error | null, unknown]> = [];
  const pipe = {
    set: (k: string, v: string) => {
      queue.push(() => {
        redisStore.set(k, v);
        return [null, 'OK'];
      });
      return pipe;
    },
    hset: (k: string, f: string, v: string) => {
      queue.push(() => {
        const h = redisHashes.get(k) ?? new Map<string, string>();
        h.set(f, v);
        redisHashes.set(k, h);
        return [null, 1];
      });
      return pipe;
    },
    exec: vi.fn(async () => queue.map((fn) => fn())),
  };
  return pipe;
}

vi.mock('../../lib/rateLimit', () => ({
  getRedis: () => mockRedis,
  getClientIP: () => '127.0.0.1',
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock('../../lib/session', () => ({
  requireSession: vi.fn(async () => ({
    userId: 'user-1',
    provider: 'google',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  })),
}));

vi.mock('../../lib/blobStore', () => ({
  putJson: vi.fn(async (path: string, value: unknown) => {
    blobStore.set(path, value);
    return { url: `https://blob/${path}` };
  }),
  getJson: vi.fn(async (path: string) => blobStore.get(path) ?? null),
  deleteBlob: vi.fn(async (path: string) => {
    blobStore.delete(path);
  }),
  headBlob: vi.fn(async () => null),
}));

interface MockRes {
  _status: number;
  _body: unknown;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  end(): MockRes;
  setHeader(): MockRes;
}

function makeRes(): MockRes {
  return {
    _status: 0,
    _body: null,
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
    setHeader() {
      return this;
    },
  };
}

function makeReq(opts: { method?: string; id?: string; body?: unknown }): VercelRequest {
  return {
    method: opts.method ?? 'GET',
    query: { id: opts.id ?? 'fake-item-1' },
    body: opts.body,
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

interface FakeEnvelope {
  value: string;
  modifiedAt: number;
  schemaVersion: number;
}

interface FakePayload {
  value: string;
  /** Explicit override so quota tests can force a byte count without a huge string literal. */
  sizeBytes?: number;
}

const FAKE_DELETED_ERROR = 'Fake resource was deleted on another device.';
const FAKE_INVALID_ID_ERROR = 'Invalid fake id';

const fakeConfig: SyncResourceConfig<FakeEnvelope> = {
  kind: 'layouts',
  payloadKey: 'thing',
  isValidId: (id) => /^[a-z0-9-]+$/.test(id),
  invalidIdError: FAKE_INVALID_ID_ERROR,
  deletedError: FAKE_DELETED_ERROR,
  buildPut: (payload, modifiedAt) => {
    const p = payload as FakePayload | undefined;
    if (typeof p?.value !== 'string') {
      return {
        ok: false,
        status: 400,
        error: 'value must be a string',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    return {
      ok: true,
      envelope: { value: p.value, modifiedAt, schemaVersion: 1 },
      sizeBytes: p.sizeBytes ?? Buffer.byteLength(p.value, 'utf8'),
      tiebreakerCandidate: p.value,
    };
  },
  storedComparable: (stored) => stored.value,
};

const handler = createSyncResourceHandler<FakeEnvelope>(fakeConfig);

function putReq(opts: { id?: string; value: string; modifiedAt: number; sizeBytes?: number }) {
  return makeReq({
    method: 'PUT',
    id: opts.id,
    body: { thing: { value: opts.value, sizeBytes: opts.sizeBytes }, modifiedAt: opts.modifiedAt },
  });
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

describe('GET', () => {
  it('returns 404 when no entry exists', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(404);
  });

  it('returns the envelope and index entry for a live resource', async () => {
    await handler(
      putReq({ value: 'hello', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    const body = res._body as {
      envelope: FakeEnvelope;
      indexEntry: { modifiedAt: number };
    };
    expect(body.envelope.value).toBe('hello');
    expect(body.envelope.modifiedAt).toBe(1000);
    expect(body.indexEntry.modifiedAt).toBe(1000);
  });

  it('returns 410 Gone with the tombstone index entry when deleted', async () => {
    await handler(
      putReq({ value: 'hello', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);

    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(410);
    const body = res._body as { code: string; indexEntry: { deletedAt?: number } };
    expect(body.code).toBe(ErrorCode.NOT_FOUND);
    expect(body.indexEntry.deletedAt).toBeDefined();
  });
});

describe('PUT — request validation', () => {
  it('rejects 400 when the body is missing', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'PUT' }), res as unknown as VercelResponse);
    expect(res._status).toBe(400);
  });

  it('rejects 400 when modifiedAt is missing or non-numeric', async () => {
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { thing: { value: 'x' }, modifiedAt: 'now' } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it("propagates buildPut's rejection status/error/code verbatim", async () => {
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { thing: { value: 42 }, modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
    const body = res._body as { error: string; code: string };
    expect(body.error).toBe('value must be a string');
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});

describe('PUT — LWW conflict', () => {
  it('creates a new entry on first write', async () => {
    const res = makeRes();
    await handler(putReq({ value: 'v1', modifiedAt: 1000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
  });

  it('accepts a write whose modifiedAt is strictly newer than the existing entry', async () => {
    await handler(
      putReq({ value: 'v1', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(putReq({ value: 'v2', modifiedAt: 2000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
  });

  it('rejects with 409 and returns the stored envelope when the remote copy is newer', async () => {
    await handler(
      putReq({ value: 'newer', modifiedAt: 5000 }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(putReq({ value: 'stale', modifiedAt: 1000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(409);
    const body = res._body as {
      code: string;
      stored: { value: string; modifiedAt: number };
      indexEntry: { modifiedAt: number };
    };
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(body.stored.value).toBe('newer');
    expect(body.stored.modifiedAt).toBe(5000);
    expect(body.indexEntry.modifiedAt).toBe(5000);
  });
});

describe('PUT — equal-ms tiebreaker', () => {
  it('is deterministic and complementary across arrival orderings', async () => {
    await handler(
      putReq({ value: 'aardvark', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    const res1 = makeRes();
    await handler(putReq({ value: 'zebra', modifiedAt: 1000 }), res1 as unknown as VercelResponse);

    redisStore = new Map();
    redisHashes = new Map();
    blobStore.clear();
    await handler(
      putReq({ value: 'zebra', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    const res2 = makeRes();
    await handler(
      putReq({ value: 'aardvark', modifiedAt: 1000 }),
      res2 as unknown as VercelResponse
    );

    // Exactly one of the two arrival orders lets the second write win — proves
    // the tiebreaker is a deterministic function of the payload, not a
    // blanket "second write always/never wins" rule.
    const statuses = [res1._status, res2._status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('returns 409 with no write when the second payload is byte-identical (no-op tie)', async () => {
    await handler(
      putReq({ value: 'same', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(putReq({ value: 'same', modifiedAt: 1000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(409);
  });

  it('repairs index/blob divergence: a missing blob skips the tiebreaker and lets the candidate write through', async () => {
    await handler(
      putReq({ value: 'first', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    // Simulate divergence: the index entry survives but the blob is gone
    // (failed prior write, manual deletion, etc.) — the index hash is left
    // untouched.
    blobStore.clear();

    const res = makeRes();
    await handler(putReq({ value: 'second', modifiedAt: 1000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);

    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    const body = getRes._body as { envelope: FakeEnvelope };
    expect(body.envelope.value).toBe('second');
  });
});

describe('DELETE and tombstone protection', () => {
  it('tombstones a live entry and deletes its blob, returning 204', async () => {
    await handler(
      putReq({ value: 'v1', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    const blobStoreMod = await import('../../lib/blobStore');
    expect(blobStoreMod.deleteBlob).toHaveBeenCalledTimes(1);
  });

  it('is idempotent (204) when nothing ever existed, and writes a tombstone', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(410);
  });

  it('is idempotent on repeated DELETE and skips deleteBlob when already tombstoned', async () => {
    const blobStoreMod = await import('../../lib/blobStore');
    const deleteBlobMock = blobStoreMod.deleteBlob as ReturnType<typeof vi.fn>;

    await handler(
      putReq({ value: 'v1', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);
    expect(deleteBlobMock).toHaveBeenCalledTimes(1);

    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res as unknown as VercelResponse);
    expect(res._status).toBe(204);
    expect(deleteBlobMock).toHaveBeenCalledTimes(1);
  });

  it('blocks resurrection: a stale PUT older than the tombstone gets 410 with the resource-specific message', async () => {
    await handler(
      putReq({ value: 'v1', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    // Tombstoned "now" — far newer than any of the small modifiedAt values below.
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);

    const res = makeRes();
    await handler(putReq({ value: 'v2', modifiedAt: 1500 }), res as unknown as VercelResponse);
    expect(res._status).toBe(410);
    const body = res._body as { error: string; code: string; indexEntry: { deletedAt?: number } };
    expect(body.error).toBe(FAKE_DELETED_ERROR);
    expect(body.code).toBe(ErrorCode.NOT_FOUND);
    expect(body.indexEntry.deletedAt).toBeDefined();

    // Resurrection blocked: the entry stays gone, not silently restored to v1.
    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(410);
  });

  it('allows a PUT newer than the tombstone to resurrect the entry', async () => {
    await handler(
      putReq({ value: 'v1', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);

    const res = makeRes();
    await handler(
      putReq({ value: 'v2', modifiedAt: Date.now() + 60_000 }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
  });
});

describe('PUT — quota enforcement', () => {
  it('rejects 413 with a bytes reason when a single write exceeds the per-kind byte cap', async () => {
    const res = makeRes();
    // fakeConfig.kind is 'layouts': maxBytes = 10 * 1024 * 1024.
    await handler(
      putReq({ value: 'x', modifiedAt: 1000, sizeBytes: 11 * 1024 * 1024 }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(413);
    const body = res._body as { code: string; error: string };
    expect(body.code).toBe(ErrorCode.SIZE_LIMIT);
    expect(body.error).toBe('Quota exceeded (bytes): 11534336 of 10485760.');

    // Nothing was written: a rejected write leaves no trace.
    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(404);
  });

  it('rejects 413 with a count reason once the per-kind item cap (100) is exceeded', async () => {
    for (let i = 0; i < 100; i++) {
      const res = makeRes();
      await handler(
        putReq({ id: `item-${i}`, value: 'v', modifiedAt: 1000 }),
        res as unknown as VercelResponse
      );
      expect(res._status).toBe(200);
    }

    const res = makeRes();
    await handler(
      putReq({ id: 'item-100', value: 'v', modifiedAt: 1000 }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(413);
    const body = res._body as { code: string; error: string };
    expect(body.code).toBe(ErrorCode.SIZE_LIMIT);
    expect(body.error).toBe('Quota exceeded (count): 101 of 100.');
  }, 20_000);
});

describe('PUT — blob write failure', () => {
  it('does not create an index entry when the blob write fails on first write', async () => {
    const blobStoreMod = await import('../../lib/blobStore');
    (blobStoreMod.putJson as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('blob store unavailable')
    );

    const res = makeRes();
    await handler(putReq({ value: 'v1', modifiedAt: 1000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(500);

    // No dangling index entry pointing at a blob that was never written.
    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(404);
  });

  it('leaves the prior envelope and index entry untouched when an overwrite blob write fails', async () => {
    await handler(
      putReq({ value: 'original', modifiedAt: 1000 }),
      makeRes() as unknown as VercelResponse
    );

    const blobStoreMod = await import('../../lib/blobStore');
    (blobStoreMod.putJson as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('blob store unavailable')
    );

    const res = makeRes();
    await handler(putReq({ value: 'updated', modifiedAt: 2000 }), res as unknown as VercelResponse);
    expect(res._status).toBe(500);

    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(200);
    const body = getRes._body as { envelope: FakeEnvelope; indexEntry: { modifiedAt: number } };
    expect(body.envelope.value).toBe('original');
    expect(body.envelope.modifiedAt).toBe(1000);
    expect(body.indexEntry.modifiedAt).toBe(1000);
  });
});

describe('id validation', () => {
  it('returns 400 for an id the resource config rejects', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET', id: 'Not Valid!' }), res as unknown as VercelResponse);
    expect(res._status).toBe(400);
    const body = res._body as { error: string };
    expect(body.error).toBe(FAKE_INVALID_ID_ERROR);
  });
});
