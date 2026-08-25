/**
 * Tests for /api/sync/designVersions/[id]. The LWW + tombstone state machine is
 * shared with every other sync resource, so the focus here is the parts unique
 * to a version: the required designId/createdAt, the uncompressed content that
 * the designer validator has to accept, and the absence of a thumbnail.
 */

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
    query: { id: opts.id ?? '11111111-2222-3333-4444-555555555555' },
    body: opts.body,
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

const VALID_DESIGN = {
  width: 2,
  depth: 2,
  height: 6,
  style: 'standard',
  scoop: true,
  base: {
    style: 'magnet',
    magnetDiameter: 6.2,
    magnetDepth: 2.4,
    screwDiameter: 3,
    stackingLip: true,
  },
  compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
  label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
  walls: { front: 0, back: 0, left: 0, right: 0 },
  inserts: [] as Record<string, unknown>[],
};

const DESIGN_ID = 'design_1700000000000_abc123';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    designVersion: {
      designId: DESIGN_ID,
      name: '0.2 mm, tight',
      createdAt: '2026-08-01T12:00:00.000Z',
      origin: 'manual',
      content: { name: 'Router Bit Holder', params: VALID_DESIGN },
      ...overrides,
    },
    modifiedAt: 1000,
  };
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

describe('PUT', () => {
  it('stores a version with its design id, name and validated content', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(makeReq({ method: 'PUT', body: validBody() }), res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    const body = res._body as {
      envelope: {
        schemaVersion: number;
        designVersion: {
          designId: string;
          name: string;
          origin: string;
          content: { params: { width: number } };
        };
      };
    };
    expect(body.envelope.schemaVersion).toBe(1);
    expect(body.envelope.designVersion.designId).toBe(DESIGN_ID);
    expect(body.envelope.designVersion.name).toBe('0.2 mm, tight');
    expect(body.envelope.designVersion.content.params.width).toBe(2);
  });

  // A version keyed to nothing would sync forever and appear in no history list.
  it('rejects a version with no design id', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({ method: 'PUT', body: validBody({ designId: undefined }) }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(400);
  });

  it('rejects a createdAt that is not a timestamp', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({ method: 'PUT', body: validBody({ createdAt: 'whenever' }) }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(400);
  });

  it('rejects content that is not an object', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({ method: 'PUT', body: validBody({ content: 'compressed-blob' }) }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(400);
  });

  // The content travels uncompressed precisely so this validator can run.
  it('rejects params the designer validator refuses', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({
        method: 'PUT',
        body: validBody({ content: { name: 'x', params: { width: 'wide' } } }),
      }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(400);
  });

  it('falls back to manual for an origin it does not recognise', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({ method: 'PUT', body: validBody({ origin: 'from-the-future' }) }),
      res as unknown as VercelResponse
    );

    const body = res._body as { envelope: { designVersion: { origin: string } } };
    expect(body.envelope.designVersion.origin).toBe('manual');
  });

  it('keeps a pre-restore origin', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({ method: 'PUT', body: validBody({ origin: 'pre-restore' }) }),
      res as unknown as VercelResponse
    );

    const body = res._body as { envelope: { designVersion: { origin: string } } };
    expect(body.envelope.designVersion.origin).toBe('pre-restore');
  });

  // A base64 PNG would consume most of MAX_PAYLOAD_BYTES; it regenerates locally.
  it('drops a thumbnail a client tries to send', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({
        method: 'PUT',
        body: validBody({ thumbnail: 'data:image/png;base64,AAAA' }),
      }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(200);
    expect(JSON.stringify(res._body)).not.toContain('base64');
  });

  it('rejects an id that is not a version id', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(
      makeReq({ method: 'PUT', id: 'not a uuid', body: validBody() }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(400);
  });

  it('refuses a stale write against a newer stored version', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { ...validBody(), modifiedAt: 5000 } }),
      makeRes() as unknown as VercelResponse
    );

    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { ...validBody(), modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(409);
  });
});

describe('GET and DELETE', () => {
  it('reads back a stored version', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: validBody() }),
      makeRes() as unknown as VercelResponse
    );

    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    const body = res._body as { envelope: { designVersion: { name: string } } };
    expect(body.envelope.designVersion.name).toBe('0.2 mm, tight');
  });

  it('reports a version it does not hold', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();

    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);

    expect(res._status).toBe(404);
  });

  it('tombstones a deleted version so a stale write cannot resurrect it', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { ...validBody(), modifiedAt: 5000 } }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);

    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { ...validBody(), modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );

    expect(res._status).toBe(410);
  });
});
