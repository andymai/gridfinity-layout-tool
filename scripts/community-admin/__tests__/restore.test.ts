import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityCardRecord } from '../../../api/lib/communityStore';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  readCommunityCards: vi.fn(),
  setCommunityDesignStatus: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../../../api/lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/communityStore.js')>();
  return {
    ...actual,
    readCommunityCards: mocks.readCommunityCards,
    setCommunityDesignStatus: mocks.setCommunityDesignStatus,
  };
});

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
}));

const { restore } = await import('../commands/restore.js');

const CARD = { id: 'abc123DEF456', status: 'hidden' } as CommunityCardRecord;

function baseArgs(positional: string[]): Args {
  return { command: 'restore', positional, json: false, yes: false, help: false };
}

function createRedis() {
  return {
    hdel: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
    quit: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setCommunityDesignStatus.mockResolvedValue(undefined);
});

describe('restore command', () => {
  it('requires an id', async () => {
    expect(await restore(baseArgs([]))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a malformed id before touching redis', async () => {
    expect(await restore(baseArgs(['nope!']))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('exits 1 when the design does not exist', async () => {
    mocks.readCommunityCards.mockResolvedValue([null]);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await restore(baseArgs(['abc123DEF456']))).toBe(1);
    expect(mocks.setCommunityDesignStatus).not.toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('sets the status back to live', async () => {
    mocks.readCommunityCards.mockResolvedValue([CARD]);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await restore(baseArgs(['abc123DEF456']))).toBe(0);
    expect(mocks.setCommunityDesignStatus).toHaveBeenCalledWith(redis, 'abc123DEF456', 'live');
    // A stale hiddenReason would mislabel the owner badge on a later hide.
    expect(redis.hdel).toHaveBeenCalledWith(
      expect.stringContaining('abc123DEF456'),
      'hiddenReason'
    );
    // A5: clear the reports set and reason tallies so a single fresh report
    // can't instantly re-hide the just-restored design.
    expect(redis.del).toHaveBeenCalledWith(
      'community:reports:abc123DEF456',
      'community:reportReasons:abc123DEF456'
    );
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
