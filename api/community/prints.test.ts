import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  requireSession: vi.fn(),
  readSession: vi.fn(),
  readSessionCookie: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
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

import {
  communityDenylistKey,
  communityDesignKey,
  communityPrintKey,
  communityPrintReportedKey,
  communityPrintReportsKey,
  communityPrintedKey,
  communityPrintsIndexKey,
  communityPrintsKey,
} from '../lib/redisKeys.js';
import { deriveAuthorPublicId } from '../lib/communityIds.js';
import { REPORT_THRESHOLD } from '../lib/contentFilter.js';

const DESIGN_ID = 'abc123def456';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

class FakeRedis {
  hashes = new Map<string, Map<string, string>>();
  sets = new Map<string, Set<string>>();
  zsets = new Map<string, Map<string, number>>();

  async hset(key: string, fields: Record<string, string | number>): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(fields)) hash.set(field, String(value));
    this.hashes.set(key, hash);
    return Object.keys(fields).length;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
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

  async srem(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.delete(member) ? 1 : 0;
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.has(member) ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  // Mirrors ioredis zadd with an optional XX flag: XX updates an existing
  // member's score and never adds a new one.
  async zadd(key: string, ...args: unknown[]): Promise<number> {
    const xx = args[0] === 'XX';
    const [score, member] = xx ? args.slice(1) : args;
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    if (xx && !zset.has(String(member))) return 0;
    zset.set(String(member), Number(score));
    this.zsets.set(key, zset);
    return 1;
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.zsets.get(key)?.delete(member) ? 1 : 0;
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const entries = [...(this.zsets.get(key) ?? new Map<string, number>()).entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)
    );
    return entries.slice(start, stop + 1).map(([member]) => member);
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      const had = this.hashes.delete(key) || this.sets.delete(key) || this.zsets.delete(key);
      if (had) removed += 1;
    }
    return removed;
  }

  pipeline() {
    const ops: Array<() => Promise<unknown>> = [];
    const pipe = {
      hset: (key: string, fields: Record<string, string | number>) => {
        ops.push(() => this.hset(key, fields));
        return pipe;
      },
      hgetall: (key: string) => {
        ops.push(() => this.hgetall(key));
        return pipe;
      },
      zadd: (key: string, ...args: unknown[]) => {
        ops.push(() => this.zadd(key, ...args));
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

let redis: FakeRedis;

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
  const mod = await import('./prints.js');
  await mod.default(
    {
      method: options.method ?? 'GET',
      headers: {},
      body: options.body,
      query: { design: DESIGN_ID, ...options.query },
    } as unknown as VercelRequest,
    res
  );
  return res;
}

/** Minimal lossy-WebP header the validator can read a canvas size out of. */
function webpBase64(width = 800, height = 600): string {
  const body = Buffer.alloc(14);
  body.writeUInt32LE(10, 0);
  body.writeUInt8(0x9d, 7);
  body.writeUInt8(0x01, 8);
  body.writeUInt8(0x2a, 9);
  body.writeUInt16LE(width, 10);
  body.writeUInt16LE(height, 12);
  const payload = Buffer.concat([Buffer.from('VP8 ', 'latin1'), body]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(payload.length + 4, 4);
  return Buffer.concat([header, Buffer.from('WEBP', 'latin1'), payload]).toString('base64');
}

function validPrintBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authorName: 'Casey',
    material: 'pla',
    nozzleMm: 0.4,
    layerHeightMm: 0.2,
    printMinutes: 124,
    printer: 'bambu-p1s',
    fitVerdict: 'as-designed',
    ...overrides,
  };
}

function authorIdFor(userId: string): string {
  const id = deriveAuthorPublicId(userId);
  if (id === null) throw new Error('TOKEN_SALT must be stubbed before deriving an author id');
  return id;
}

/** Seed a live design as publish leaves it: card hash plus index membership. */
function seedLiveDesign(): void {
  redis.hashes.set(
    communityDesignKey(DESIGN_ID),
    new Map([
      ['id', DESIGN_ID],
      ['status', 'live'],
    ])
  );
  redis.zsets.set(communityPrintsIndexKey(), new Map([[DESIGN_ID, 0]]));
}

function signedInAs(userId: string): void {
  mocks.requireSession.mockResolvedValue({ userId, token: 'tok' });
  mocks.readSessionCookie.mockReturnValue('tok');
  mocks.readSession.mockResolvedValue({ userId, token: 'tok' });
}

/**
 * Mirrors the real requireSession contract: it sends the 401 itself and
 * returns null, so handlers just bail without writing a second response.
 */
function signedOut(): void {
  mocks.requireSession.mockImplementation(async (_req: unknown, res: VercelResponse) => {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  });
  mocks.readSessionCookie.mockReturnValue(undefined);
  mocks.readSession.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOKEN_SALT', 'test-salt');
  vi.stubEnv('COMMUNITY_PRINTS_ENABLED', 'true');
  redis = new FakeRedis();
  mocks.getRedis.mockReturnValue(redis);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 });
  mocks.put.mockImplementation(async (path: string) => ({ url: `https://blob.example/${path}` }));
  mocks.del.mockResolvedValue(undefined);
  signedInAs(USER_ID);
  seedLiveDesign();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('kill switch', () => {
  it('503s every method while COMMUNITY_PRINTS_ENABLED is not "true"', async () => {
    vi.stubEnv('COMMUNITY_PRINTS_ENABLED', 'false');

    for (const method of ['GET', 'PUT', 'DELETE', 'POST']) {
      const res = await handle({ method, body: validPrintBody() });
      expect(res._status).toBe(503);
    }
  });
});

describe('design id validation', () => {
  it('rejects a malformed design id', async () => {
    const res = await handle({ query: { design: 'nope' } });
    expect(res._status).toBe(400);
  });

  it('rejects a missing design id', async () => {
    const res = await handle({ query: { design: '' } });
    expect(res._status).toBe(400);
  });
});

describe('PUT (create)', () => {
  it('stores a print and mirrors the count onto the design', async () => {
    const res = await handle({ method: 'PUT', body: validPrintBody() });

    expect(res._status).toBe(201);
    const body = res._body as { print: { authorName: string }; count: number };
    expect(body.print.authorName).toBe('Casey');
    expect(body.count).toBe(1);

    const author = authorIdFor(USER_ID);
    expect(redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('status')).toBe('live');
    expect(redis.zsets.get(communityPrintsKey(DESIGN_ID))?.has(author)).toBe(true);
    expect(redis.sets.get(communityPrintedKey(USER_ID))?.has(DESIGN_ID)).toBe(true);
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('prints')).toBe('1');
  });

  it('rescores the design in the prints index', async () => {
    await handle({ method: 'PUT', body: validPrintBody() });
    expect(redis.zsets.get(communityPrintsIndexKey())?.get(DESIGN_ID)).toBe(1);
  });

  it('never re-adds a design moderation dropped from the prints index', async () => {
    redis.zsets.get(communityPrintsIndexKey())?.delete(DESIGN_ID);

    await handle({ method: 'PUT', body: validPrintBody() });

    // XX on the index ZADD: a print must not resurrect a moderated design.
    expect(redis.zsets.get(communityPrintsIndexKey())?.has(DESIGN_ID)).toBe(false);
    // The card counter still updates, so a restore rescores from the truth.
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('prints')).toBe('1');
  });

  it('requires a session', async () => {
    signedOut();
    const res = await handle({ method: 'PUT', body: validPrintBody() });
    expect(res._status).toBe(401);
  });

  it('404s when the design is not live', async () => {
    redis.hashes.get(communityDesignKey(DESIGN_ID))?.set('status', 'hidden');
    const res = await handle({ method: 'PUT', body: validPrintBody() });
    expect(res._status).toBe(404);
  });

  it('rejects a deny-listed account without naming the deny list', async () => {
    await redis.sadd(communityDenylistKey(), USER_ID);

    const res = await handle({ method: 'PUT', body: validPrintBody() });

    expect(res._status).toBe(403);
    expect(JSON.stringify(res._body)).not.toMatch(/deny|denylist|banned/i);
  });

  it('surfaces the rate limit', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handle({ method: 'PUT', body: validPrintBody() });
    expect(res._status).toBe(429);
  });

  it('passes validation errors through with their code', async () => {
    const res = await handle({ method: 'PUT', body: validPrintBody({ material: 'resin' }) });
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_MATERIAL');
  });

  it('uploads photos to salted, revision-stamped paths', async () => {
    const res = await handle({
      method: 'PUT',
      body: validPrintBody({ photos: [webpBase64(), webpBase64(400, 400)] }),
    });

    expect(res._status).toBe(201);
    expect(mocks.put).toHaveBeenCalledTimes(2);
    const [firstPath] = mocks.put.mock.calls[0] as [string];
    expect(firstPath).toMatch(
      new RegExp(`^community/prints/${DESIGN_ID}-[a-f0-9]{32}-[a-f0-9]{16}-1-0\\.webp$`)
    );
  });

  it('deletes freshly uploaded photos when the write fails', async () => {
    const spy = vi.spyOn(redis, 'hset').mockRejectedValueOnce(new Error('redis down'));

    const res = await handle({ method: 'PUT', body: validPrintBody({ photos: [webpBase64()] }) });

    expect(res._status).toBe(500);
    expect(mocks.del).toHaveBeenCalledWith([expect.stringContaining('community/prints/')]);
    spy.mockRestore();
  });
});

describe('PUT (edit)', () => {
  async function seedOwnPrint(photos: string[] = []): Promise<string> {
    await handle({ method: 'PUT', body: validPrintBody({ photos }) });
    return authorIdFor(USER_ID);
  }

  it('replaces the record and keeps the original createdAt', async () => {
    const author = await seedOwnPrint();
    const createdAt = redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('createdAt');

    const res = await handle({
      method: 'PUT',
      body: validPrintBody({ fitVerdict: 'adjusted', note: 'scaled 2 percent' }),
    });

    expect(res._status).toBe(200);
    const hash = redis.hashes.get(communityPrintKey(DESIGN_ID, author));
    expect(hash?.get('fitVerdict')).toBe('adjusted');
    // A typo fix must not reshuffle the newest-first list.
    expect(hash?.get('createdAt')).toBe(createdAt);
  });

  it('never double-counts the same printer', async () => {
    await seedOwnPrint();
    const res = await handle({ method: 'PUT', body: validPrintBody({ note: 'again' }) });

    expect((res._body as { count: number }).count).toBe(1);
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('prints')).toBe('1');
  });

  it('carries a kept photo over without re-uploading it', async () => {
    const author = await seedOwnPrint([webpBase64()]);
    const kept = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    mocks.put.mockClear();

    const res = await handle({ method: 'PUT', body: validPrintBody({ photos: kept }) });

    expect(res._status).toBe(200);
    expect(mocks.put).not.toHaveBeenCalled();
    expect((res._body as { print: { photos: string[] } }).print.photos).toEqual(kept);
  });

  it('holds the revision steady when an edit uploads nothing', async () => {
    const author = await seedOwnPrint([webpBase64()]);
    const rev = redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('rev');
    const kept = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];

    await handle({ method: 'PUT', body: validPrintBody({ photos: kept, note: 'typo fix' }) });

    expect(redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('rev')).toBe(rev);
  });

  it('advances the revision so an added photo cannot collide with a kept one', async () => {
    const author = await seedOwnPrint([webpBase64()]);
    const kept = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    mocks.put.mockClear();

    // Keep photo 0 and add another. Both are index 0 of their batch, so a
    // stable rev would make the upload target the kept photo's own path.
    const res = await handle({
      method: 'PUT',
      body: validPrintBody({ photos: [...kept, webpBase64(500, 500)] }),
    });

    expect(res._status).toBe(200);
    const [uploadPath] = mocks.put.mock.calls[0] as [string];
    expect(uploadPath).toContain('-2-0.webp');
    expect(kept[0]).not.toContain('-2-0.webp');
  });

  it('uploads a browsing-sized copy beside its photo', async () => {
    const res = await handle({
      method: 'PUT',
      body: validPrintBody({
        photos: [{ photo: webpBase64(1200, 900), thumb: webpBase64(400, 300) }],
      }),
    });
    // No existing record, so this is a create.
    expect(res._status).toBe(201);
    const paths = mocks.put.mock.calls.map((call) => (call as [string])[0]);
    expect(paths).toHaveLength(2);
    expect(paths[1]).toContain('-t.webp');
    const body = res._body as { print: { photos: string[]; photoThumbs: string[] } };
    expect(body.print.photoThumbs[0]).toContain('-t.webp');
  });

  it('records an empty copy when the client sent none', async () => {
    const res = await handle({
      method: 'PUT',
      body: validPrintBody({ photos: [webpBase64(1200, 900)] }),
    });
    const body = res._body as { print: { photos: string[]; photoThumbs: string[] } };
    // Same length as photos regardless, so a reader can index one from the
    // other without checking.
    expect(body.print.photoThumbs).toEqual(['']);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('keeps each copy with its own photo across a reorder-plus-add edit', async () => {
    // The two lists are rebuilt in one pass from the same entry precisely so
    // they cannot drift; this is the edit that would expose it if they did.
    const author = await seedOwnPrint();
    await handle({
      method: 'PUT',
      body: validPrintBody({
        photos: [
          { photo: webpBase64(1200, 900), thumb: webpBase64(400, 300) },
          { photo: webpBase64(1100, 800), thumb: webpBase64(360, 260) },
        ],
      }),
    });
    const stored = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    const storedThumbs = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photoThumbs') ?? '[]'
    ) as string[];

    // Reverse them and splice a fresh upload into the middle.
    const res = await handle({
      method: 'PUT',
      body: validPrintBody({
        photos: [
          stored[1],
          { photo: webpBase64(900, 700), thumb: webpBase64(300, 240) },
          stored[0],
        ],
      }),
    });

    const body = res._body as { print: { photos: string[]; photoThumbs: string[] } };
    expect(body.print.photos).toHaveLength(3);
    expect(body.print.photoThumbs).toHaveLength(3);
    // Each kept photo still carries the copy it arrived with.
    expect(body.print.photos[0]).toBe(stored[1]);
    expect(body.print.photoThumbs[0]).toBe(storedThumbs[1]);
    expect(body.print.photos[2]).toBe(stored[0]);
    expect(body.print.photoThumbs[2]).toBe(storedThumbs[0]);
    expect(body.print.photoThumbs[1]).toContain('-t.webp');
  });

  it('carries no copy forward for a photo that never had one', async () => {
    const author = await seedOwnPrint([webpBase64()]);
    const kept = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    const res = await handle({ method: 'PUT', body: validPrintBody({ photos: kept }) });
    const body = res._body as { print: { photoThumbs: string[] } };
    expect(body.print.photoThumbs).toEqual(['']);
  });

  it('rejects a kept URL that does not belong to this print', async () => {
    await seedOwnPrint([webpBase64()]);

    const res = await handle({
      method: 'PUT',
      body: validPrintBody({ photos: ['https://blob.example/someone-elses.webp'] }),
    });

    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('INVALID_PHOTOS');
  });

  it('cleans up photos the edit dropped', async () => {
    const author = await seedOwnPrint([webpBase64()]);
    const original = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    mocks.del.mockClear();

    await handle({ method: 'PUT', body: validPrintBody({ photos: [] }) });

    expect(mocks.del).toHaveBeenCalledWith(original);
  });

  it('refuses to edit a print that moderation hid', async () => {
    const author = await seedOwnPrint();
    redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.set('status', 'hidden');

    const res = await handle({ method: 'PUT', body: validPrintBody() });

    expect(res._status).toBe(403);
  });
});

describe('GET', () => {
  it('lists live prints with a derived summary', async () => {
    await handle({ method: 'PUT', body: validPrintBody({ printMinutes: 100 }) });
    signedInAs(OTHER_USER_ID);
    await handle({
      method: 'PUT',
      body: validPrintBody({ printMinutes: 140, fitVerdict: 'adjusted', material: 'petg' }),
    });

    const res = await handle({ method: 'GET' });

    expect(res._status).toBe(200);
    const body = res._body as {
      items: unknown[];
      summary: { count: number; asDesigned: number; adjusted: number; medianPrintMinutes: number };
      nextCursor: string | null;
    };
    expect(body.items).toHaveLength(2);
    expect(body.summary).toMatchObject({
      count: 2,
      asDesigned: 1,
      adjusted: 1,
      medianPrintMinutes: 120,
    });
    expect(body.nextCursor).toBeNull();
  });

  it('returns the caller their own print even when signed in as its author', async () => {
    await handle({ method: 'PUT', body: validPrintBody({ note: 'mine' }) });

    const res = await handle({ method: 'GET' });

    const body = res._body as { mine: { note: string } | null };
    expect(body.mine?.note).toBe('mine');
  });

  it('still returns a hidden print to its own author, with its status', async () => {
    await handle({ method: 'PUT', body: validPrintBody({ note: 'mine' }) });
    const author = authorIdFor(USER_ID);
    redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.set('status', 'hidden');
    await redis.zrem(communityPrintsKey(DESIGN_ID), author);

    const res = await handle({ method: 'GET' });

    const body = res._body as { items: unknown[]; mine: { status: string } | null };
    // Gone from the public list, but the author can still see what happened
    // and delete it: moderation keeps the hash precisely for that.
    expect(body.items).toHaveLength(0);
    expect(body.mine?.status).toBe('hidden');
  });

  it('serves anonymously with no own print', async () => {
    await handle({ method: 'PUT', body: validPrintBody() });
    signedOut();

    const res = await handle({ method: 'GET' });

    expect(res._status).toBe(200);
    expect((res._body as { mine: unknown }).mine).toBeNull();
  });

  it('404s for a design that is not live', async () => {
    redis.hashes.get(communityDesignKey(DESIGN_ID))?.set('status', 'hidden');
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(404);
  });

  it('rejects a malformed cursor', async () => {
    const res = await handle({ method: 'GET', query: { cursor: 'abc' } });
    expect(res._status).toBe(400);
  });

  it('omits the summary on a follow-up page', async () => {
    await handle({ method: 'PUT', body: validPrintBody() });

    const res = await handle({ method: 'GET', query: { cursor: '24' } });

    expect((res._body as { summary: unknown }).summary).toBeNull();
  });
});

describe('DELETE', () => {
  it('removes the print, its photos, and its share of the count', async () => {
    await handle({ method: 'PUT', body: validPrintBody({ photos: [webpBase64()] }) });
    const author = authorIdFor(USER_ID);
    mocks.del.mockClear();

    const res = await handle({ method: 'DELETE' });

    expect(res._status).toBe(200);
    expect((res._body as { count: number }).count).toBe(0);
    expect(redis.hashes.has(communityPrintKey(DESIGN_ID, author))).toBe(false);
    expect(redis.sets.get(communityPrintedKey(USER_ID))?.has(DESIGN_ID)).toBe(false);
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('prints')).toBe('0');
    expect(mocks.del).toHaveBeenCalledWith([expect.stringContaining('community/prints/')]);
  });

  it('drops the design cover when the promoted photo is deleted with the print', async () => {
    await handle({ method: 'PUT', body: validPrintBody({ photos: [webpBase64()] }) });
    const author = authorIdFor(USER_ID);
    const photos = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    redis.hashes.get(communityDesignKey(DESIGN_ID))?.set('coverPhotoUrl', photos[0] ?? 'x');

    await handle({ method: 'DELETE' });

    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('coverPhotoUrl')).toBe('');
  });

  it('drops the cover’s browsing copy with it', async () => {
    // Leaving it behind would keep the deleted photo rendering on the gallery
    // card, since that is the field the card actually reads.
    await handle({
      method: 'PUT',
      body: validPrintBody({
        photos: [{ photo: webpBase64(1200, 900), thumb: webpBase64(400, 300) }],
      }),
    });
    const author = authorIdFor(USER_ID);
    const photos = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('photos') ?? '[]'
    ) as string[];
    const design = redis.hashes.get(communityDesignKey(DESIGN_ID));
    design?.set('coverPhotoUrl', photos[0]);
    design?.set('coverPhotoThumbUrl', 'https://blob.example/cover-t.webp');

    await handle({ method: 'DELETE' });

    expect(design?.get('coverPhotoUrl')).toBe('');
    expect(design?.get('coverPhotoThumbUrl')).toBe('');
  });

  it('404s when there is nothing to delete', async () => {
    const res = await handle({ method: 'DELETE' });
    expect(res._status).toBe(404);
  });

  // The upsert path refuses to edit a hidden print back into visibility, but
  // delete-then-repost reached the same place: with the record gone, the
  // re-visibility check found nothing and wrote a fresh 'live' one.
  describe('moderated print', () => {
    async function seedHiddenOwnPrint(): Promise<string> {
      await handle({ method: 'PUT', body: validPrintBody({ photos: [webpBase64()] }) });
      const author = authorIdFor(USER_ID);
      redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.set('status', 'hidden');
      return author;
    }

    it('409s a delete of a report-hidden print', async () => {
      const author = await seedHiddenOwnPrint();

      const res = await handle({ method: 'DELETE' });

      expect(res._status).toBe(409);
      expect((res._body as { code: string }).code).toBe('UNDER_REVIEW');
      expect(redis.hashes.has(communityPrintKey(DESIGN_ID, author))).toBe(true);
    });

    it('re-creates as hidden when the persisted reporter set is still over threshold', async () => {
      const author = await seedHiddenOwnPrint();
      const reports = new Set<string>();
      for (let i = 0; i < 5; i++) reports.add(`reporter-${i}`);
      redis.sets.set(communityPrintReportsKey(DESIGN_ID, author), reports);
      // Simulate the record being gone by any route (the delete guard above is
      // the first line of defence; this is the second). Mirrors what
      // deleteCommunityPrint clears — note it deliberately keeps the reporter
      // set, which is what makes this recovery possible.
      redis.hashes.delete(communityPrintKey(DESIGN_ID, author));
      redis.zsets.get(communityPrintsKey(DESIGN_ID))?.delete(author);

      const res = await handle({ method: 'PUT', body: validPrintBody({ photos: [webpBase64()] }) });

      expect(res._status).toBe(201);
      expect(redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('status')).toBe('hidden');
      // Hidden means out of the public list and out of the printer count.
      expect(redis.zsets.get(communityPrintsKey(DESIGN_ID))?.has(author)).toBeFalsy();
    });

    it('re-creates as live when the reporter set is below threshold', async () => {
      const author = await seedHiddenOwnPrint();
      redis.sets.set(communityPrintReportsKey(DESIGN_ID, author), new Set(['reporter-0']));
      redis.hashes.delete(communityPrintKey(DESIGN_ID, author));

      await handle({ method: 'PUT', body: validPrintBody({ photos: [webpBase64()] }) });

      expect(redis.hashes.get(communityPrintKey(DESIGN_ID, author))?.get('status')).toBe('live');
    });
  });

  it('requires a session', async () => {
    signedOut();
    const res = await handle({ method: 'DELETE' });
    expect(res._status).toBe(401);
  });

  it('surfaces the rate limit', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handle({ method: 'DELETE' });
    expect(res._status).toBe(429);
  });
});

describe('POST report', () => {
  async function seedOtherUsersPrint(photos: string[] = []): Promise<string> {
    signedInAs(OTHER_USER_ID);
    await handle({ method: 'PUT', body: validPrintBody({ photos }) });
    signedInAs(USER_ID);
    return authorIdFor(OTHER_USER_ID);
  }

  /** Distinct prior reporters, so the session account's report is the Nth. */
  function seedReporters(target: string, count: number): void {
    const key = communityPrintReportsKey(DESIGN_ID, target);
    const reports = redis.sets.get(key) ?? new Set<string>();
    for (let i = 0; i < count; i++) reports.add(`reporter-${i}`);
    redis.sets.set(key, reports);
  }

  it('records a report and its reverse index', async () => {
    const target = await seedOtherUsersPrint();

    const res = await handle({
      method: 'POST',
      body: { action: 'report', printer: target, reason: 'spam' },
    });

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ reported: true, hidden: false });
    expect(redis.sets.get(communityPrintReportsKey(DESIGN_ID, target))?.has(USER_ID)).toBe(true);
    expect(redis.sets.get(communityPrintReportedKey(USER_ID))?.has(`${DESIGN_ID}:${target}`)).toBe(
      true
    );
  });

  it('dedupes a repeat report from the same account', async () => {
    const target = await seedOtherUsersPrint();
    const report = { action: 'report', printer: target, reason: 'spam' };

    await handle({ method: 'POST', body: report });
    await handle({ method: 'POST', body: report });

    expect(redis.sets.get(communityPrintReportsKey(DESIGN_ID, target))?.size).toBe(1);
  });

  it('hides the print and drops the count once the threshold is met', async () => {
    const target = await seedOtherUsersPrint();
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('prints')).toBe('1');

    // One short of the threshold, so the session account's report trips it.
    seedReporters(target, REPORT_THRESHOLD - 1);

    const res = await handle({
      method: 'POST',
      body: { action: 'report', printer: target, reason: 'inappropriate' },
    });

    expect(res._body).toEqual({ reported: true, hidden: true });
    const hash = redis.hashes.get(communityPrintKey(DESIGN_ID, target));
    expect(hash?.get('status')).toBe('hidden');
    expect(hash?.get('hiddenReason')).toBe('reports');
    // The hash survives so the dedupe holds, but it leaves the zset and count.
    expect(redis.zsets.get(communityPrintsKey(DESIGN_ID))?.has(target)).toBe(false);
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('prints')).toBe('0');
  });

  it("drops the design cover when the promoted photo's print is hidden", async () => {
    const target = await seedOtherUsersPrint([webpBase64()]);
    const photos = JSON.parse(
      redis.hashes.get(communityPrintKey(DESIGN_ID, target))?.get('photos') ?? '[]'
    ) as string[];
    expect(photos).toHaveLength(1);
    // Promote the print's photo, then trip the report threshold on it.
    redis.hashes.get(communityDesignKey(DESIGN_ID))?.set('coverPhotoUrl', photos[0]);
    seedReporters(target, REPORT_THRESHOLD - 1);

    await handle({ method: 'POST', body: { action: 'report', printer: target, reason: 'spam' } });

    // Otherwise moderation takes the print down while its photo keeps running
    // on the most public surface in the app.
    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('coverPhotoUrl')).toBe('');
  });

  it('leaves an unrelated cover alone when a print is hidden', async () => {
    const target = await seedOtherUsersPrint();
    redis.hashes
      .get(communityDesignKey(DESIGN_ID))
      ?.set('coverPhotoUrl', 'https://blob.example/other.webp');
    seedReporters(target, REPORT_THRESHOLD - 1);

    await handle({ method: 'POST', body: { action: 'report', printer: target, reason: 'spam' } });

    expect(redis.hashes.get(communityDesignKey(DESIGN_ID))?.get('coverPhotoUrl')).toBe(
      'https://blob.example/other.webp'
    );
  });

  it('drops a hidden print out of the public list', async () => {
    const target = await seedOtherUsersPrint();
    seedReporters(target, REPORT_THRESHOLD - 1);
    await handle({ method: 'POST', body: { action: 'report', printer: target, reason: 'spam' } });

    const res = await handle({ method: 'GET' });

    expect((res._body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('refuses a self-report', async () => {
    await handle({ method: 'PUT', body: validPrintBody() });

    const res = await handle({
      method: 'POST',
      body: { action: 'report', printer: authorIdFor(USER_ID), reason: 'spam' },
    });

    expect(res._status).toBe(400);
  });

  it('rejects an unknown reason', async () => {
    const target = await seedOtherUsersPrint();

    const res = await handle({
      method: 'POST',
      body: { action: 'report', printer: target, reason: 'because' },
    });

    expect(res._status).toBe(400);
  });

  it('rejects a malformed printer id', async () => {
    const res = await handle({
      method: 'POST',
      body: { action: 'report', printer: 'not-an-id', reason: 'spam' },
    });

    expect(res._status).toBe(400);
  });

  it('404s when the target print does not exist', async () => {
    const res = await handle({
      method: 'POST',
      body: { action: 'report', printer: 'f'.repeat(32), reason: 'spam' },
    });

    expect(res._status).toBe(404);
  });

  it('rejects an unknown action', async () => {
    const res = await handle({ method: 'POST', body: { action: 'boost' } });
    expect(res._status).toBe(400);
  });
});

describe('method handling', () => {
  it('405s an unsupported method', async () => {
    const res = await handle({ method: 'PATCH' });
    expect(res._status).toBe(405);
  });

  it('answers preflight', async () => {
    const res = await handle({ method: 'OPTIONS' });
    expect(res._status).toBe(200);
  });
});
