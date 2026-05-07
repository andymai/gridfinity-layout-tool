import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let redisStore: Map<string, string>;
let redisHashes: Map<string, Map<string, string>>;
const blobStore = new Map<string, unknown>();

const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  hgetall: vi.fn(async (k: string) => {
    const h = redisHashes.get(k);
    return h ? Object.fromEntries(h) : {};
  }),
  pipeline: vi.fn(() => {
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

vi.mock('../lib/blobStore', () => ({
  putJson: vi.fn(),
  getJson: vi.fn(async (path: string) => blobStore.get(path) ?? null),
  deleteBlob: vi.fn(),
  headBlob: vi.fn(async () => null),
}));

interface MockRes {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  send(body: unknown): MockRes;
  end(): MockRes;
  setHeader(k: string, v: string): MockRes;
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
    send(body) {
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
  };
}

function makeReq(): VercelRequest {
  return {
    method: 'GET',
    query: {},
    headers: {},
  } as unknown as VercelRequest;
}

async function seedItem(
  kind: 'layouts' | 'designs',
  id: string,
  modifiedAt: number,
  envelope: unknown,
  opts: { tombstone?: boolean } = {}
): Promise<void> {
  const userIndex = await import('../lib/userIndex');
  if (opts.tombstone) {
    await userIndex.tombstone(mockRedis as never, 'user-1', kind, id, modifiedAt);
  } else {
    await userIndex.upsertEntry(mockRedis as never, 'user-1', kind, id, {
      modifiedAt,
      sizeBytes: 100,
    });
    blobStore.set(`users/user-1/${kind}/${id}.json`, envelope);
  }
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

describe('GET /api/sync/export', () => {
  it('returns an empty zip with just manifest.json for a fresh user', async () => {
    const { default: handler } = await import('./export');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/zip');
    expect(res._headers['Content-Disposition']).toMatch(/^attachment; filename=/);
    expect(Buffer.isBuffer(res._body)).toBe(true);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(res._body as Buffer);
    const names = Object.keys(zip.files);
    expect(names).toContain('manifest.json');
    expect(names.filter((n) => n.startsWith('layouts/'))).toEqual([]);
  });

  it('packages live layouts and designs into separate folders', async () => {
    await seedItem('layouts', 'lay-1', 1000, {
      layout: { name: 'L1' },
      modifiedAt: 1000,
      schemaVersion: 1,
    });
    await seedItem('designs', 'des-1', 2000, {
      design: { width: 2 },
      modifiedAt: 2000,
      schemaVersion: 1,
    });

    const { default: handler } = await import('./export');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(200);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(res._body as Buffer);
    const fileEntries = Object.entries(zip.files)
      .filter(([, entry]) => !entry.dir)
      .map(([name]) => name)
      .sort();
    expect(fileEntries).toEqual(['designs/des-1.json', 'layouts/lay-1.json', 'manifest.json']);

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.layouts['lay-1'].modifiedAt).toBe(1000);
    expect(manifest.designs['des-1'].modifiedAt).toBe(2000);
    expect(manifest.exportedAt).toBeGreaterThan(0);
  });

  it('skips tombstoned items in both the manifest and the file list', async () => {
    await seedItem('layouts', 'lay-live', 1000, {
      layout: { name: 'L' },
      modifiedAt: 1000,
      schemaVersion: 1,
    });
    await seedItem('layouts', 'lay-dead', 2000, null, { tombstone: true });

    const { default: handler } = await import('./export');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(res._body as Buffer);
    expect(zip.file('layouts/lay-live.json')).toBeTruthy();
    expect(zip.file('layouts/lay-dead.json')).toBe(null);

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.layouts).toHaveProperty('lay-live');
    expect(manifest.layouts).not.toHaveProperty('lay-dead');
  });

  it('returns 429 when rate-limited', async () => {
    const rateLimit = await import('../lib/rateLimit');
    (rateLimit.checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 30,
    });
    const { default: handler } = await import('./export');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });
});
