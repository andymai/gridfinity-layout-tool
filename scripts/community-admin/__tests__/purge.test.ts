import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityCardRecord, CommunityDesignRecord } from '../../../api/lib/communityStore';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  deleteBlob: vi.fn(),
  readCommunityDesignBlob: vi.fn(),
  readCommunityCards: vi.fn(),
  connect: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../../../api/lib/blobStore.js', () => ({
  deleteBlob: mocks.deleteBlob,
}));

vi.mock('../../../api/lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/communityStore.js')>();
  return {
    ...actual,
    readCommunityDesignBlob: mocks.readCommunityDesignBlob,
    readCommunityCards: mocks.readCommunityCards,
  };
});

vi.mock('../../../api/lib/logger.js', () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
}));

const { purge } = await import('../commands/purge.js');
const { communityDesignBlobPath } = await import('../../../api/lib/communityStore.js');

interface PipelineCommand {
  op: string;
  args: unknown[];
}

function createFakeRedis(likerIds: string[]) {
  const commands: PipelineCommand[] = [];
  const pipeline = {
    del: (...args: unknown[]) => {
      commands.push({ op: 'del', args });
      return pipeline;
    },
    zrem: (...args: unknown[]) => {
      commands.push({ op: 'zrem', args });
      return pipeline;
    },
    srem: (...args: unknown[]) => {
      commands.push({ op: 'srem', args });
      return pipeline;
    },
    exec: vi.fn(async () => commands.map(() => [null, 1])),
  };
  const redis = {
    smembers: vi.fn(async () => likerIds),
    pipeline: () => pipeline,
    quit: vi.fn(async () => undefined),
  };
  return { redis, commands };
}

function baseArgs(positional: string[], yes = true): Args {
  return { command: 'purge', positional, json: false, yes, help: false };
}

const RECORD: CommunityDesignRecord = {
  id: 'abc123DEF456',
  authorPublicId: 'author-pub-id',
  authorName: 'Jane',
  name: 'Screwdriver tray',
  description: '',
  category: 'tools',
  techniques: [],
  params: {},
  metrics: { width: 2, depth: 2, height: 2, gridUnitMm: 42 },
  lineage: {
    parentId: 'parent123ABC',
    rootId: 'parent123ABC',
    parentName: 'Original tray',
    parentAuthorName: 'Alan',
    rootAuthorName: 'Alan',
  },
  thumbnails: [
    'https://blob.example/community/thumbs/abc123DEF456-1-0.webp',
    'https://blob.example/community/thumbs/abc123DEF456-1-1.webp',
  ],
  meshUrl: 'https://blob.example/community/meshes/abc123DEF456-1.glb',
  photos: [],
  featured: false,
  createdAt: 1,
  updatedAt: 1,
  status: 'live',
};

const CARD: CommunityCardRecord = {
  id: 'abc123DEF456',
  name: 'Screwdriver tray',
  parentId: 'parentabc123',
  authorPublicId: 'author-pub-id',
  authorName: 'Jane',
  category: 'tools',
  techniques: [],
  width: 2,
  depth: 2,
  height: 2,
  gridUnitMm: 42,
  thumbnailUrl: 'https://blob.example/community/thumbs/abc123DEF456-1-0.webp',
  isRemix: true,
  featured: false,
  createdAt: 1,
  updatedAt: 1,
  status: 'live',
  likes: 2,
  remixes: 0,
  exports: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOKEN_SALT', 'test-salt');
});

describe('purge command', () => {
  it('refuses to run without --yes and never connects to redis', async () => {
    const code = await purge(baseArgs(['abc123DEF456'], false));
    expect(code).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('404s when neither the blob nor the card resolve', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(null);
    mocks.readCommunityCards.mockResolvedValue([null]);
    const { redis } = createFakeRedis([]);
    mocks.connect.mockReturnValue(redis);

    const code = await purge(baseArgs(['abc123DEF456']));

    expect(code).toBe(1);
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('deletes every blob, cascades likes, and enumerates all redis keys on the pipeline', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(RECORD);
    mocks.readCommunityCards.mockResolvedValue([CARD]);
    mocks.deleteBlob.mockResolvedValue(undefined);
    const { redis, commands } = createFakeRedis(['liker-1', 'liker-2']);
    mocks.connect.mockReturnValue(redis);

    const code = await purge(baseArgs(['abc123DEF456']));

    expect(code).toBe(0);
    expect(mocks.deleteBlob).toHaveBeenCalledTimes(4);
    expect(mocks.deleteBlob).toHaveBeenNthCalledWith(1, communityDesignBlobPath('abc123DEF456'));
    expect(mocks.deleteBlob).toHaveBeenNthCalledWith(
      2,
      'https://blob.example/community/thumbs/abc123DEF456-1-0.webp'
    );
    expect(mocks.deleteBlob).toHaveBeenNthCalledWith(
      3,
      'https://blob.example/community/thumbs/abc123DEF456-1-1.webp'
    );
    expect(mocks.deleteBlob).toHaveBeenNthCalledWith(
      4,
      'https://blob.example/community/meshes/abc123DEF456-1.glb'
    );

    expect(commands).toContainEqual({ op: 'del', args: ['community:design:abc123DEF456'] });
    expect(commands).toContainEqual({
      op: 'zrem',
      args: ['community:index:newest', 'abc123DEF456'],
    });
    expect(commands).toContainEqual({
      op: 'zrem',
      args: ['community:index:remixes', 'abc123DEF456'],
    });
    expect(commands).toContainEqual({
      op: 'zrem',
      args: ['community:index:likes', 'abc123DEF456'],
    });
    expect(commands).toContainEqual({
      op: 'srem',
      args: ['community:author:author-pub-id', 'abc123DEF456'],
    });
    expect(commands).toContainEqual({
      op: 'srem',
      args: ['community:children:parent123ABC', 'abc123DEF456'],
    });
    expect(commands).toContainEqual({ op: 'del', args: ['community:reports:abc123DEF456'] });
    // A15: the reason-tally hash is purged too, not orphaned.
    expect(commands).toContainEqual({ op: 'del', args: ['community:reportReasons:abc123DEF456'] });
    expect(commands).toContainEqual({ op: 'del', args: ['community:likes:abc123DEF456'] });
    expect(commands).toContainEqual({ op: 'del', args: ['community:children:abc123DEF456'] });
    expect(commands).toContainEqual({
      op: 'srem',
      args: ['community:liked:liker-1', 'abc123DEF456'],
    });
    expect(commands).toContainEqual({
      op: 'srem',
      args: ['community:liked:liker-2', 'abc123DEF456'],
    });
  });

  it('continues the rest of the cleanup on a per-blob failure but fails loud (non-zero exit)', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(RECORD);
    mocks.readCommunityCards.mockResolvedValue([CARD]);
    mocks.deleteBlob
      .mockRejectedValueOnce(new Error('blob store unavailable'))
      .mockResolvedValue(undefined);
    const { redis, commands } = createFakeRedis([]);
    mocks.connect.mockReturnValue(redis);

    const code = await purge(baseArgs(['abc123DEF456']));

    // Fail loud: a takedown that could not delete a world-readable blob exits
    // non-zero so the operator knows, but still completes the redis cleanup so
    // the design leaves the gallery.
    expect(code).toBe(1);
    expect(mocks.loggerError).toHaveBeenCalledTimes(1);
    expect(mocks.deleteBlob).toHaveBeenCalledTimes(4);
    expect(commands).toContainEqual({ op: 'del', args: ['community:design:abc123DEF456'] });
  });

  it('rejects a malformed id before touching redis or blob storage', async () => {
    const code = await purge(baseArgs(['../../etc/passwd']));
    expect(code).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
