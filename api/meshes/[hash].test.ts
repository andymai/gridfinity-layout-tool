import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type * as VercelBlobModule from '@vercel/blob';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  requireSession: vi.fn(),
  put: vi.fn(),
  head: vi.fn(),
}));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('../lib/session.js', () => ({
  requireSession: mocks.requireSession,
}));

// The real BlobNotFoundError keeps blobStore's `instanceof` check honest.
vi.mock('@vercel/blob', async () => {
  const actual = await vi.importActual<typeof VercelBlobModule>('@vercel/blob');
  return { ...actual, put: mocks.put, head: mocks.head };
});

import { BlobNotFoundError } from '@vercel/blob';
import { unwrap } from '../../src/core/result/index.js';
import { encodeMeshData } from '../../src/shared/generation/meshAsset.js';
import { encodeMeshFile } from '../../src/shared/generation/meshFile.js';
import type { MeshFileContent } from '../../src/shared/generation/meshFile.js';
import { meshHoldersKey, userMeshesKey } from '../lib/redisKeys.js';
import { MAX_MESH_UPLOAD_BYTES, meshBlobPath, meshFileHash } from '../lib/meshFile.js';
import { MESH_QUOTA_BYTES } from '../lib/quota.js';
import handler, { MESH_URL_HEADER } from './[hash].js';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const BLOB_ORIGIN = 'https://store.public.blob.vercel-storage.com';

type Reply = [Error | null, unknown];

class FakeRedis {
  hashes = new Map<string, Map<string, string>>();
  sets = new Map<string, Set<string>>();

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key) ?? new Map<string, string>());
  }

  hset(key: string, field: string, value: string): number {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    hash.set(field, value);
    this.hashes.set(key, hash);
    return 1;
  }

  sadd(key: string, member: string): number {
    const set = this.sets.get(key) ?? new Set<string>();
    set.add(member);
    this.sets.set(key, set);
    return 1;
  }

  pipeline(): Record<string, unknown> {
    const queue: (() => unknown)[] = [];
    const chain = {
      hset: (k: string, f: string, v: string) => {
        queue.push(() => this.hset(k, f, v));
        return chain;
      },
      sadd: (k: string, m: string) => {
        queue.push(() => this.sadd(k, m));
        return chain;
      },
      exec: async (): Promise<Reply[]> => queue.map((run) => [null, run()]),
    };
    return chain;
  }
}

/** Vercel Blob keyed by pathname; put honours `allowOverwrite: false`. */
let blobs: Map<string, Buffer>;
let redis: FakeRedis;

interface MockRes {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  end(): MockRes;
  setHeader(key: string, value: string): MockRes;
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
    setHeader(key, value) {
      this._headers[key] = value;
      return this;
    },
  };
}

interface RequestOptions {
  method?: string;
  hash?: string;
  body?: unknown;
  contentType?: string;
}

async function handle(options: RequestOptions): Promise<MockRes> {
  const req = {
    method: options.method ?? 'PUT',
    query: { hash: options.hash ?? 'a'.repeat(64) },
    body: options.body,
    headers: {
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'gflt',
      'content-type': options.contentType ?? 'application/octet-stream',
    },
  } as unknown as VercelRequest;
  const res = makeRes();
  await handler(req, res as unknown as VercelResponse);
  return res;
}

function upload(bytes: Uint8Array, hash = meshFileHash(bytes)): Promise<MockRes> {
  return handle({ method: 'PUT', hash, body: Buffer.from(bytes) });
}

function check(hash: string): Promise<MockRes> {
  return handle({ method: 'HEAD', hash, contentType: '' });
}

function signedInAs(userId: string): void {
  mocks.requireSession.mockResolvedValue({ userId, provider: 'google' });
}

/** Mirrors requireSession: it sends the 401 itself and returns null. */
function signedOut(): void {
  mocks.requireSession.mockImplementation(async (_req: unknown, res: VercelResponse) => {
    res.status(401).json({ error: 'Not signed in', code: 'UNAUTHORIZED' });
    return null;
  });
}

const SQUARE = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
];

async function content(overrides: Partial<MeshFileContent> = {}): Promise<MeshFileContent> {
  const positions = new Float32Array([0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    outlines: [SQUARE],
    ...overrides,
  };
}

async function meshFile(overrides: Partial<MeshFileContent> = {}): Promise<Uint8Array> {
  return unwrap(encodeMeshFile(await content(overrides)));
}

function heldBy(userId: string, hash: string): unknown {
  const raw = redis.hashes.get(userMeshesKey(userId))?.get(hash);
  return raw === undefined ? undefined : (JSON.parse(raw) as unknown);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MESH_STORE_ENABLED', 'true');
  redis = new FakeRedis();
  blobs = new Map();
  mocks.getRedis.mockReturnValue(redis);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 });
  mocks.head.mockImplementation(async (path: string) => {
    if (!blobs.has(path)) throw new BlobNotFoundError();
    return { url: `${BLOB_ORIGIN}/${path}` };
  });
  mocks.put.mockImplementation(
    async (path: string, body: Buffer, options: { allowOverwrite: boolean }) => {
      if (blobs.has(path) && !options.allowOverwrite) {
        throw new Error('Vercel Blob: This blob already exists');
      }
      blobs.set(path, body);
      return { url: `${BLOB_ORIGIN}/${path}` };
    }
  );
  signedInAs(USER_ID);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('kill switch', () => {
  it.each([undefined, 'false', '1', 'TRUE'])(
    '503s every method while MESH_STORE_ENABLED is %s',
    async (value) => {
      if (value === undefined) vi.stubEnv('MESH_STORE_ENABLED', undefined);
      else vi.stubEnv('MESH_STORE_ENABLED', value);
      const file = await meshFile();

      expect((await upload(file))._status).toBe(503);
      expect((await check(meshFileHash(file)))._status).toBe(503);
      expect(mocks.requireSession).not.toHaveBeenCalled();
      expect(mocks.put).not.toHaveBeenCalled();
    }
  );
});

describe('gates', () => {
  it('requires a session for both methods', async () => {
    signedOut();
    const file = await meshFile();

    expect((await upload(file))._status).toBe(401);
    expect((await check(meshFileHash(file)))._status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(redis.hashes.size).toBe(0);
  });

  it('405s methods other than PUT and HEAD', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) {
      expect((await handle({ method }))._status).toBe(405);
    }
  });

  it('rate limits uploads and checks per user on their own buckets', async () => {
    const file = await meshFile();
    await upload(file);
    await check(meshFileHash(file));
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(1, USER_ID, 'mesh.write');
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(2, USER_ID, 'mesh.read');

    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 });
    expect((await upload(file))._status).toBe(429);
  });

  it.each(['A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64), '../meshes'])(
    'rejects the malformed hash %s',
    async (hash) => {
      expect((await handle({ method: 'HEAD', hash }))._status).toBe(400);
      expect((await upload(await meshFile(), hash))._status).toBe(400);
    }
  );
});

describe('PUT', () => {
  it('stores a new file once, public and unoverwritable, and records the hold', async () => {
    const file = await meshFile();
    const hash = meshFileHash(file);

    const res = await upload(file);

    const url = `${BLOB_ORIGIN}/${meshBlobPath(hash)}`;
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ hash, url, sizeBytes: file.byteLength });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][2]).toEqual({
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    expect(new Uint8Array(blobs.get(meshBlobPath(hash)) ?? [])).toEqual(file);
    expect(heldBy(USER_ID, hash)).toEqual({ sizeBytes: file.byteLength, url });
    expect(redis.sets.get(meshHoldersKey(hash))).toEqual(new Set([`user:${USER_ID}`]));
  });

  it('415s a body that is not application/octet-stream', async () => {
    const file = await meshFile();
    const res = await handle({
      method: 'PUT',
      hash: meshFileHash(file),
      body: { data: 'x' },
      contentType: 'application/json',
    });
    expect(res._status).toBe(415);
  });

  it('400s a missing body', async () => {
    expect((await handle({ method: 'PUT', body: undefined }))._status).toBe(400);
    expect((await handle({ method: 'PUT', body: Buffer.alloc(0) }))._status).toBe(400);
  });

  it('413s a body over the upload cap', async () => {
    const res = await handle({ method: 'PUT', body: Buffer.alloc(MAX_MESH_UPLOAD_BYTES + 1) });
    expect(res._status).toBe(413);
    expect(res._body).toMatchObject({ code: 'SIZE_LIMIT' });
  });

  it('400s a body whose SHA-256 is not the hash in the URL', async () => {
    const file = await meshFile();
    const other = await meshFile({ triangleCount: 5 });
    const res = await upload(file, meshFileHash(other));
    expect(res._status).toBe(400);
    expect(res._body).toMatchObject({ error: 'Body does not match the hash in the URL' });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a bad magic',
      async () => {
        const file = await meshFile();
        new DataView(file.buffer).setUint32(0, 0, true);
        return file;
      },
      'bad magic',
    ],
    [
      'too many triangles',
      async () => {
        const file = await meshFile();
        new DataView(file.buffer).setUint32(8, 50_001, true);
        return file;
      },
      'triangle count',
    ],
    [
      'a declared count below the geometry',
      () => meshFile({ triangleCount: 3 }),
      'more triangles than the file declares',
    ],
    [
      'an outline point out of bounds',
      async () => {
        const file = await meshFile();
        new DataView(file.buffer).setFloat64(file.byteLength - 8, 5000, true);
        return file;
      },
      'outline points',
    ],
  ])('400s a file with %s and stores nothing', async (_label, build, reason) => {
    const res = await upload(await build());
    expect(res._status).toBe(400);
    expect(res._body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((res._body as { error: string }).error).toContain(reason);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(redis.hashes.size).toBe(0);
  });

  it('answers a re-PUT of a held file with a cheap 200', async () => {
    const file = await meshFile();
    const first = await upload(file);
    mocks.head.mockClear();
    mocks.put.mockClear();

    const second = await upload(file);

    expect(second._status).toBe(200);
    expect(second._body).toEqual(first._body);
    expect(mocks.head).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(redis.sets.get(meshHoldersKey(meshFileHash(file)))?.size).toBe(1);
  });

  it('writes nothing for a file another account stored, but still charges this one', async () => {
    const file = await meshFile();
    const hash = meshFileHash(file);
    signedInAs(OTHER_USER_ID);
    await upload(file);
    mocks.put.mockClear();
    signedInAs(USER_ID);

    const res = await upload(file);

    expect(res._status).toBe(200);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(heldBy(USER_ID, hash)).toMatchObject({ sizeBytes: file.byteLength });
    expect(redis.sets.get(meshHoldersKey(hash))).toEqual(
      new Set([`user:${OTHER_USER_ID}`, `user:${USER_ID}`])
    );
  });

  it('413s a file that would take the account over its mesh quota', async () => {
    const file = await meshFile();
    redis.hset(
      userMeshesKey(USER_ID),
      'f'.repeat(64),
      JSON.stringify({ sizeBytes: MESH_QUOTA_BYTES - file.byteLength + 1, url: 'u' })
    );

    const res = await upload(file);

    expect(res._status).toBe(413);
    expect(res._body).toMatchObject({ code: 'SIZE_LIMIT' });
    expect((res._body as { error: string }).error).toMatch(/^Quota exceeded \(bytes\)/);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(heldBy(USER_ID, meshFileHash(file))).toBeUndefined();
  });

  it('fills the quota exactly, and counts a held file once on re-PUT', async () => {
    const file = await meshFile();
    redis.hset(
      userMeshesKey(USER_ID),
      'f'.repeat(64),
      JSON.stringify({ sizeBytes: MESH_QUOTA_BYTES - file.byteLength, url: 'u' })
    );

    expect((await upload(file))._status).toBe(200);
    expect((await upload(file))._status).toBe(200);
    expect((await upload(await meshFile({ triangleCount: 5 })))._status).toBe(413);
  });

  it('settles on the stored blob when a racing upload of the same file wins', async () => {
    const file = await meshFile();
    const hash = meshFileHash(file);
    mocks.put.mockImplementationOnce(async (path: string, body: Buffer) => {
      blobs.set(path, body);
      throw new Error('Vercel Blob: This blob already exists');
    });

    const res = await upload(file);

    expect(res._status).toBe(200);
    expect(heldBy(USER_ID, hash)).toEqual({
      sizeBytes: file.byteLength,
      url: `${BLOB_ORIGIN}/${meshBlobPath(hash)}`,
    });
  });

  it('500s and records no hold when the blob write fails', async () => {
    mocks.put.mockRejectedValueOnce(new Error('blob storage down'));

    const res = await upload(await meshFile());

    expect(res._status).toBe(500);
    expect(redis.hashes.size).toBe(0);
    expect(redis.sets.size).toBe(0);
  });
});

describe('HEAD', () => {
  it('404s a file this account does not hold, even when another account does', async () => {
    const file = await meshFile();
    const hash = meshFileHash(file);
    expect((await check(hash))._status).toBe(404);

    signedInAs(OTHER_USER_ID);
    await upload(file);
    signedInAs(USER_ID);

    const res = await check(hash);
    expect(res._status).toBe(404);
    expect(res._headers[MESH_URL_HEADER]).toBeUndefined();
  });

  it('200s a held file with its URL in a header, without touching Blob', async () => {
    const file = await meshFile();
    const hash = meshFileHash(file);
    await upload(file);
    mocks.head.mockClear();

    const res = await check(hash);

    expect(res._status).toBe(200);
    expect(res._ended).toBe(true);
    expect(res._headers[MESH_URL_HEADER]).toBe(`${BLOB_ORIGIN}/${meshBlobPath(hash)}`);
    expect(mocks.head).not.toHaveBeenCalled();
  });
});
