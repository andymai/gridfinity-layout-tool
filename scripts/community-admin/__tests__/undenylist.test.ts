import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
}));

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
}));

const { undenylist } = await import('../commands/undenylist.js');

function baseArgs(positional: string[]): Args {
  return { command: 'undenylist', positional, json: false, yes: false, help: false, reason: null };
}

function createRedis(sremResult: number) {
  return {
    srem: vi.fn(async () => sremResult),
    quit: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('undenylist command', () => {
  it('requires a userId', async () => {
    expect(await undenylist(baseArgs([]))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('removes the user from the deny-list', async () => {
    const redis = createRedis(1);
    mocks.connect.mockReturnValue(redis);

    expect(await undenylist(baseArgs(['user-1']))).toBe(0);
    expect(redis.srem).toHaveBeenCalledWith('community:denylist', 'user-1');
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('exits 0 when the user was not on the deny-list', async () => {
    const redis = createRedis(0);
    mocks.connect.mockReturnValue(redis);

    expect(await undenylist(baseArgs(['user-1']))).toBe(0);
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
