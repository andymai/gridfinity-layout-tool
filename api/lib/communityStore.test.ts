import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Redis } from 'ioredis';

const mocks = vi.hoisted(() => ({
  putJson: vi.fn(),
  getJson: vi.fn(),
  deleteBlob: vi.fn(),
}));

vi.mock('./blobStore.js', () => ({
  putJson: mocks.putJson,
  getJson: mocks.getJson,
  deleteBlob: mocks.deleteBlob,
}));

import {
  communityDesignBlobPath,
  communityThumbBlobPath,
  communityMeshBlobPath,
  deriveCommunityMetrics,
  writeCommunityDesignBlob,
  readCommunityDesignBlob,
  deleteCommunityDesignBlob,
  writeCommunityCard,
  readCommunityCards,
  upsertCommunityIndexes,
  removeFromCommunityIndexes,
  setCommunityDesignStatus,
  communityContentHash,
  type CommunityCardMetadata,
  type CommunityDesignRecord,
} from './communityStore.js';

interface PipelineCall {
  command: string;
  args: unknown[];
}

function createPipeline(execResults: Array<[Error | null, unknown]> = []) {
  const calls: PipelineCall[] = [];
  const pipeline = {
    calls,
    hgetall(key: string) {
      calls.push({ command: 'hgetall', args: [key] });
      return pipeline;
    },
    zadd(key: string, score: number, member: string) {
      calls.push({ command: 'zadd', args: [key, score, member] });
      return pipeline;
    },
    zrem(key: string, member: string) {
      calls.push({ command: 'zrem', args: [key, member] });
      return pipeline;
    },
    exec: vi.fn(async () => execResults),
  };
  return pipeline;
}

function createRedis(pipeline: ReturnType<typeof createPipeline>) {
  const hset = vi.fn(async () => 1);
  const hmget = vi.fn(async () => [] as (string | null)[]);
  const redis = { hset, hmget, pipeline: vi.fn(() => pipeline) };
  return { redis: redis as unknown as Redis, hset, hmget };
}

const DESIGN: CommunityDesignRecord = {
  id: 'abc123def456',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Andy',
  name: 'Socket Organizer',
  description: 'Holds 24 sockets.',
  category: 'tools',
  techniques: ['scoop'],
  params: { width: 2 },
  metrics: { width: 2, depth: 3, height: 6, gridUnitMm: 42 },
  lineage: null,
  thumbnails: ['https://blob.example/t0.webp'],
  meshUrl: 'https://blob.example/m.glb',
  photos: [],
  featured: false,
  createdAt: 1000,
  updatedAt: 2000,
  status: 'live',
};

const CARD: CommunityCardMetadata = {
  id: 'abc123def456',
  name: 'Socket Organizer',
  parentId: '',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Andy',
  category: 'tools',
  techniques: ['scoop'],
  width: 2,
  depth: 3,
  height: 6,
  gridUnitMm: 42,
  thumbnailUrl: 'https://blob.example/t0.webp',
  isRemix: false,
  featured: false,
  createdAt: 1000,
  updatedAt: 2000,
  status: 'live',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOKEN_SALT', 'test-salt');
  mocks.putJson.mockResolvedValue({ url: 'https://blob.example/design.json' });
  mocks.getJson.mockResolvedValue(null);
  mocks.deleteBlob.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('blob paths', () => {
  it('builds salted design, thumbnail, and mesh paths', () => {
    expect(communityDesignBlobPath('abc123def456')).toMatch(
      /^community\/designs\/abc123def456-[a-f0-9]{16}\.json$/
    );
    expect(communityThumbBlobPath('abc123def456', 3, 1)).toMatch(
      /^community\/thumbs\/abc123def456-[a-f0-9]{16}-3-1\.webp$/
    );
    expect(communityMeshBlobPath('abc123def456', 3)).toMatch(
      /^community\/meshes\/abc123def456-[a-f0-9]{16}-3\.glb$/
    );
  });

  it('derives paths deterministically but never from the id alone', () => {
    const first = communityDesignBlobPath('abc123def456');
    expect(communityDesignBlobPath('abc123def456')).toBe(first);
    expect(communityDesignBlobPath('abc123def457')).not.toBe(first);
    const firstThumb = communityThumbBlobPath('abc123def456', 1, 0);
    expect(communityThumbBlobPath('abc123def456', 1, 0)).toBe(firstThumb);
    const firstMesh = communityMeshBlobPath('abc123def456', 1);

    vi.stubEnv('TOKEN_SALT', 'other-salt');
    expect(communityDesignBlobPath('abc123def456')).not.toBe(first);
    expect(communityThumbBlobPath('abc123def456', 1, 0)).not.toBe(firstThumb);
    expect(communityMeshBlobPath('abc123def456', 1)).not.toBe(firstMesh);
  });

  it('refuses to derive any path without TOKEN_SALT', () => {
    vi.stubEnv('TOKEN_SALT', '');
    expect(() => communityDesignBlobPath('abc123def456')).toThrow(/TOKEN_SALT/);
    expect(() => communityThumbBlobPath('abc123def456', 1, 0)).toThrow(/TOKEN_SALT/);
    expect(() => communityMeshBlobPath('abc123def456', 1)).toThrow(/TOKEN_SALT/);
  });
});

describe('deriveCommunityMetrics', () => {
  it('converts grid units to outer millimetres', () => {
    expect(
      deriveCommunityMetrics({ width: 2, depth: 3, height: 6, gridUnitMm: 42, heightUnitMm: 7 })
    ).toEqual({ width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 });
  });

  it('falls back to spec defaults for missing or non-positive values', () => {
    expect(deriveCommunityMetrics({})).toEqual({
      width: 41.5,
      depth: 41.5,
      height: 7,
      gridUnitMm: 42,
    });
    expect(deriveCommunityMetrics({ width: -3, depth: Number.NaN, height: '9' })).toEqual({
      width: 41.5,
      depth: 41.5,
      height: 7,
      gridUnitMm: 42,
    });
  });
});

describe('design blob helpers', () => {
  it('writes with CAS by default and returns the blob url', async () => {
    const url = await writeCommunityDesignBlob(DESIGN);
    expect(url).toBe('https://blob.example/design.json');
    expect(mocks.putJson).toHaveBeenCalledWith(communityDesignBlobPath('abc123def456'), DESIGN, {
      allowOverwrite: false,
    });
  });

  it('allows overwrite for updates when asked', async () => {
    await writeCommunityDesignBlob(DESIGN, { allowOverwrite: true });
    expect(mocks.putJson).toHaveBeenCalledWith(communityDesignBlobPath('abc123def456'), DESIGN, {
      allowOverwrite: true,
    });
  });

  it('reads through getJson', async () => {
    mocks.getJson.mockResolvedValue(DESIGN);
    expect(await readCommunityDesignBlob('abc123def456')).toEqual(DESIGN);
    expect(mocks.getJson).toHaveBeenCalledWith(communityDesignBlobPath('abc123def456'));
  });

  it('deletes through deleteBlob', async () => {
    await deleteCommunityDesignBlob('abc123def456');
    expect(mocks.deleteBlob).toHaveBeenCalledWith(communityDesignBlobPath('abc123def456'));
  });
});

describe('writeCommunityCard', () => {
  it('writes metadata fields to the card hash without touching counters', async () => {
    const { redis, hset } = createRedis(createPipeline());
    await writeCommunityCard(redis, CARD);

    expect(hset).toHaveBeenCalledTimes(1);
    const [key, fields] = hset.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(key).toBe('community:design:abc123def456');
    expect(fields.techniques).toBe('["scoop"]');
    expect(fields.status).toBe('live');
    expect(fields.isRemix).toBe('0');
    expect(fields).not.toHaveProperty('likes');
    expect(fields).not.toHaveProperty('remixes');
    expect(fields).not.toHaveProperty('exports');
  });
});

describe('readCommunityCards', () => {
  it('returns [] for an empty id page without a pipeline round trip', async () => {
    const pipeline = createPipeline();
    const { redis } = createRedis(pipeline);
    expect(await readCommunityCards(redis, [])).toEqual([]);
    expect(pipeline.exec).not.toHaveBeenCalled();
  });

  it('pipelines one HGETALL per id and parses cards positionally', async () => {
    const storedFields = {
      id: CARD.id,
      name: CARD.name,
      authorPublicId: CARD.authorPublicId,
      authorName: CARD.authorName,
      category: CARD.category,
      techniques: '["scoop"]',
      width: '2',
      depth: '3',
      height: '6',
      gridUnitMm: '42',
      thumbnailUrl: CARD.thumbnailUrl,
      isRemix: '0',
      featured: '1',
      createdAt: '1000',
      updatedAt: '2000',
      status: 'live',
      likes: '7',
      remixes: '2',
      exports: '31',
    };
    const pipeline = createPipeline([
      [null, storedFields],
      [null, {}],
      [new Error('boom'), null],
    ]);
    const { redis } = createRedis(pipeline);

    const cards = await readCommunityCards(redis, [
      'abc123def456',
      'missing000000',
      'errored00000',
    ]);

    expect(pipeline.calls).toEqual([
      { command: 'hgetall', args: ['community:design:abc123def456'] },
      { command: 'hgetall', args: ['community:design:missing000000'] },
      { command: 'hgetall', args: ['community:design:errored00000'] },
    ]);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toEqual({ ...CARD, featured: true, likes: 7, remixes: 2, exports: 31 });
    expect(cards[1]).toBeNull();
    expect(cards[2]).toBeNull();
  });

  it('rejects a hash with an unknown status', async () => {
    const pipeline = createPipeline([[null, { id: 'x', status: 'weird' }]]);
    const { redis } = createRedis(pipeline);
    expect(await readCommunityCards(redis, ['x'])).toEqual([null]);
  });
});

describe('index helpers', () => {
  it('upserts all three sort indexes in one pipeline', async () => {
    const pipeline = createPipeline();
    const { redis } = createRedis(pipeline);

    await upsertCommunityIndexes(redis, 'abc123def456', { createdAt: 1000, remixes: 4, likes: 9 });

    expect(pipeline.calls).toEqual([
      { command: 'zadd', args: ['community:index:newest', 1000, 'abc123def456'] },
      { command: 'zadd', args: ['community:index:remixes', 4, 'abc123def456'] },
      { command: 'zadd', args: ['community:index:likes', 9, 'abc123def456'] },
    ]);
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
  });

  it('removes from all three sort indexes in one pipeline', async () => {
    const pipeline = createPipeline();
    const { redis } = createRedis(pipeline);

    await removeFromCommunityIndexes(redis, 'abc123def456');

    expect(pipeline.calls).toEqual([
      { command: 'zrem', args: ['community:index:newest', 'abc123def456'] },
      { command: 'zrem', args: ['community:index:remixes', 'abc123def456'] },
      { command: 'zrem', args: ['community:index:likes', 'abc123def456'] },
    ]);
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
  });
});

describe('setCommunityDesignStatus', () => {
  it('restoring to live re-indexes with scores from the card hash', async () => {
    const pipeline = createPipeline();
    const { redis, hset, hmget } = createRedis(pipeline);
    hmget.mockResolvedValue(['1000', '4', '9']);

    await setCommunityDesignStatus(redis, 'abc123def456', 'live');

    expect(hset).toHaveBeenCalledWith('community:design:abc123def456', { status: 'live' });
    expect(hmget).toHaveBeenCalledWith(
      'community:design:abc123def456',
      'createdAt',
      'remixes',
      'likes'
    );
    expect(pipeline.calls).toEqual([
      { command: 'zadd', args: ['community:index:newest', 1000, 'abc123def456'] },
      { command: 'zadd', args: ['community:index:remixes', 4, 'abc123def456'] },
      { command: 'zadd', args: ['community:index:likes', 9, 'abc123def456'] },
    ]);
  });

  it.each(['hidden', 'removed'] as const)(
    '%s removes the design from every index',
    async (status) => {
      const pipeline = createPipeline();
      const { redis, hset, hmget } = createRedis(pipeline);

      await setCommunityDesignStatus(redis, 'abc123def456', status);

      expect(hset).toHaveBeenCalledWith('community:design:abc123def456', { status });
      expect(hmget).not.toHaveBeenCalled();
      expect(pipeline.calls.map((c) => c.command)).toEqual(['zrem', 'zrem', 'zrem']);
    }
  );
});

describe('communityContentHash', () => {
  const content = {
    params: { width: 2, compartments: { cols: 2, cells: [0, 1] } },
    name: 'Socket Organizer',
    description: 'Holds 24 sockets.',
    category: 'tools',
  };

  it('is a 32-char hex digest', () => {
    expect(communityContentHash(content)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is stable under object key ordering', () => {
    const reordered = {
      category: 'tools',
      description: 'Holds 24 sockets.',
      name: 'Socket Organizer',
      params: { compartments: { cells: [0, 1], cols: 2 }, width: 2 },
    };
    expect(communityContentHash(reordered)).toBe(communityContentHash(content));
  });

  it('changes when any content field changes', () => {
    const base = communityContentHash(content);
    expect(communityContentHash({ ...content, name: 'Other' })).not.toBe(base);
    expect(communityContentHash({ ...content, description: '' })).not.toBe(base);
    expect(communityContentHash({ ...content, category: 'other' })).not.toBe(base);
    expect(communityContentHash({ ...content, params: { width: 3 } })).not.toBe(base);
  });

  it('is sensitive to array order (cells are positional)', () => {
    const swapped = {
      ...content,
      params: { ...content.params, compartments: { cols: 2, cells: [1, 0] } },
    };
    expect(communityContentHash(swapped)).not.toBe(communityContentHash(content));
  });
});
