import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  purgeCommunityAssets: vi.fn(),
}));

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
}));

vi.mock('../lib/assets.js', () => ({
  purgeCommunityAssets: mocks.purgeCommunityAssets,
}));

const { denylist } = await import('../commands/denylist.js');

interface FakeRedis {
  hashes: Map<string, Map<string, string>>;
  sets: Map<string, Set<string>>;
  zsets: Map<string, Map<string, number>>;
  sadd: (key: string, member: string) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  hset: (key: string, fields: Record<string, string>) => Promise<number>;
  hget: (key: string, field: string) => Promise<string | null>;
  hmget: (key: string, ...fields: string[]) => Promise<(string | null)[]>;
  pipeline: () => {
    hgetall: (key: string) => unknown;
    zadd: (key: string, score: number, member: string) => unknown;
    zrem: (key: string, member: string) => unknown;
    exec: () => Promise<Array<[Error | null, unknown]>>;
  };
  quit: ReturnType<typeof vi.fn>;
}

function createFakeRedis(): FakeRedis {
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();
  const zsets = new Map<string, Map<string, number>>();
  const redis: FakeRedis = {
    hashes,
    sets,
    zsets,
    async sadd(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      const added = set.has(member) ? 0 : 1;
      set.add(member);
      sets.set(key, set);
      return added;
    },
    async smembers(key) {
      return [...(sets.get(key) ?? new Set<string>())];
    },
    async hset(key, fields) {
      const hash = hashes.get(key) ?? new Map<string, string>();
      for (const [field, value] of Object.entries(fields)) hash.set(field, String(value));
      hashes.set(key, hash);
      return Object.keys(fields).length;
    },
    async hget(key, field) {
      return hashes.get(key)?.get(field) ?? null;
    },
    async hmget(key, ...fields) {
      const hash = hashes.get(key);
      return fields.map((field) => hash?.get(field) ?? null);
    },
    pipeline() {
      const ops: Array<() => Promise<unknown>> = [];
      const pipe = {
        hgetall: (key: string) => {
          ops.push(async () => Object.fromEntries(hashes.get(key) ?? new Map<string, string>()));
          return pipe;
        },
        zadd: (key: string, score: number, member: string) => {
          ops.push(async () => {
            const zset = zsets.get(key) ?? new Map<string, number>();
            zset.set(member, score);
            zsets.set(key, zset);
            return 1;
          });
          return pipe;
        },
        zrem: (key: string, member: string) => {
          ops.push(async () => (zsets.get(key)?.delete(member) ? 1 : 0));
          return pipe;
        },
        exec: async (): Promise<Array<[Error | null, unknown]>> => {
          const out: Array<[Error | null, unknown]> = [];
          for (const op of ops) out.push([null, await op()]);
          ops.length = 0;
          return out;
        },
      };
      return pipe;
    },
    quit: vi.fn(async () => undefined),
  };
  return redis;
}

function seedCard(redis: FakeRedis, id: string, status: string): void {
  redis.hashes.set(
    `community:design:${id}`,
    new Map(
      Object.entries({
        id,
        name: `Design ${id}`,
        authorPublicId: 'irrelevant',
        authorName: 'Someone',
        category: 'tools',
        techniques: '[]',
        status,
        createdAt: '1000',
        remixes: '0',
        likes: '0',
      })
    )
  );
  if (status === 'live') {
    for (const sort of ['newest', 'remixes', 'likes']) {
      const key = `community:index:${sort}`;
      const zset = redis.zsets.get(key) ?? new Map<string, number>();
      zset.set(id, 1);
      redis.zsets.set(key, zset);
    }
  }
}

function baseArgs(positional: string[]): Args {
  return { command: 'denylist', positional, json: false, yes: false, help: false, reason: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.purgeCommunityAssets.mockResolvedValue(undefined);
  vi.stubEnv('TOKEN_SALT', 'test-salt');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('denylist command', () => {
  it('requires a userId', async () => {
    const code = await denylist(baseArgs([]));
    expect(code).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('refuses to run without TOKEN_SALT', async () => {
    vi.stubEnv('TOKEN_SALT', '');
    const code = await denylist(baseArgs(['user-1']));
    expect(code).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('bars the user and hides only their live designs', async () => {
    const { deriveAuthorPublicId } = await import('../../../api/lib/communityIds.js');
    const authorPublicId = String(deriveAuthorPublicId('user-1'));

    const redis = createFakeRedis();
    seedCard(redis, 'liveAAAAAAAA', 'live');
    seedCard(redis, 'hiddenBBBBBB', 'hidden');
    seedCard(redis, 'otherCCCCCCC', 'live');
    redis.sets.set(`community:author:${authorPublicId}`, new Set(['liveAAAAAAAA', 'hiddenBBBBBB']));
    redis.sets.set('community:author:someone-else', new Set(['otherCCCCCCC']));
    mocks.connect.mockReturnValue(redis);

    const code = await denylist(baseArgs(['user-1']));
    expect(code).toBe(0);

    expect(redis.sets.get('community:denylist')).toEqual(new Set(['user-1']));
    expect(redis.hashes.get('community:design:liveAAAAAAAA')?.get('status')).toBe('hidden');
    expect(redis.hashes.get('community:design:hiddenBBBBBB')?.get('status')).toBe('hidden');
    expect(redis.hashes.get('community:design:otherCCCCCCC')?.get('status')).toBe('live');
    for (const sort of ['newest', 'remixes', 'likes']) {
      const zset = redis.zsets.get(`community:index:${sort}`);
      expect(zset?.has('liveAAAAAAAA')).toBe(false);
      expect(zset?.has('otherCCCCCCC')).toBe(true);
    }
    // A10: the deny-list sweep is a takedown, so each newly hidden design's
    // CDN assets are deleted (the already-hidden one is left untouched).
    expect(mocks.purgeCommunityAssets).toHaveBeenCalledWith('liveAAAAAAAA');
    expect(mocks.purgeCommunityAssets).not.toHaveBeenCalledWith('otherCCCCCCC');
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('still adds the deny-list entry when the user has no live designs', async () => {
    const redis = createFakeRedis();
    mocks.connect.mockReturnValue(redis);

    const code = await denylist(baseArgs(['user-2']));
    expect(code).toBe(0);
    expect(redis.sets.get('community:denylist')).toEqual(new Set(['user-2']));
  });
});
