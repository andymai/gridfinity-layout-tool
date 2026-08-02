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

const { hide } = await import('../commands/hide.js');

const CARD = { id: 'abc123DEF456', status: 'live' } as CommunityCardRecord;

function baseArgs(positional: string[]): Args {
  return { command: 'hide', positional, json: false, yes: false, help: false };
}

function createRedis() {
  return { hset: vi.fn(async () => 1), quit: vi.fn(async () => undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setCommunityDesignStatus.mockResolvedValue(undefined);
});

describe('hide command', () => {
  it('requires an id', async () => {
    expect(await hide(baseArgs([]))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a malformed id before touching redis', async () => {
    expect(await hide(baseArgs(['../../etc/passwd']))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('exits 1 when the design does not exist', async () => {
    mocks.readCommunityCards.mockResolvedValue([null]);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await hide(baseArgs(['abc123DEF456']))).toBe(1);
    expect(mocks.setCommunityDesignStatus).not.toHaveBeenCalled();
    expect(redis.hset).not.toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('sets the status to hidden with a moderation reason', async () => {
    mocks.readCommunityCards.mockResolvedValue([CARD]);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await hide(baseArgs(['abc123DEF456']))).toBe(0);
    expect(mocks.setCommunityDesignStatus).toHaveBeenCalledWith(redis, 'abc123DEF456', 'hidden');
    // A reason-less hidden design reads as a pending report auto-hide in the
    // owner's Mine view; the manual hide must write its own reason.
    expect(redis.hset).toHaveBeenCalledWith(expect.stringContaining('abc123DEF456'), {
      hiddenReason: 'moderation',
    });
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
