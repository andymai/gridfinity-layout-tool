import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityDesignRecord } from '../../../api/lib/communityStore';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  readCommunityDesignBlob: vi.fn(),
  writeCommunityDesignBlob: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../../../api/lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/communityStore.js')>();
  return {
    ...actual,
    readCommunityDesignBlob: mocks.readCommunityDesignBlob,
    writeCommunityDesignBlob: mocks.writeCommunityDesignBlob,
  };
});

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
}));

const { feature, unfeature } = await import('../commands/feature.js');

const RECORD = {
  id: 'abc123DEF456',
  featured: false,
  updatedAt: 1,
} as CommunityDesignRecord;

function baseArgs(command: string, positional: string[]): Args {
  return { command, positional, json: false, yes: false, help: false };
}

function createRedis() {
  return {
    hset: vi.fn(async () => 1),
    quit: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writeCommunityDesignBlob.mockResolvedValue('https://blob.example/design.json');
});

describe('feature/unfeature commands', () => {
  it('requires an id', async () => {
    expect(await feature(baseArgs('feature', []))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a malformed id before touching redis', async () => {
    expect(await feature(baseArgs('feature', ['nope!']))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('exits 1 when the design blob does not exist', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(null);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await feature(baseArgs('feature', ['abc123DEF456']))).toBe(1);
    expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    expect(redis.hset).not.toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('feature sets the flag on both the blob and the card hash', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(RECORD);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await feature(baseArgs('feature', ['abc123DEF456']))).toBe(0);
    const written = mocks.writeCommunityDesignBlob.mock.calls[0] as [
      CommunityDesignRecord,
      { allowOverwrite: boolean },
    ];
    expect(written[0].featured).toBe(true);
    expect(written[1]).toEqual({ allowOverwrite: true });
    expect(redis.hset).toHaveBeenCalledWith('community:design:abc123DEF456', { featured: '1' });
  });

  it('unfeature clears the flag on both writers', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue({ ...RECORD, featured: true });
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await unfeature(baseArgs('unfeature', ['abc123DEF456']))).toBe(0);
    const written = mocks.writeCommunityDesignBlob.mock.calls[0][0] as CommunityDesignRecord;
    expect(written.featured).toBe(false);
    expect(redis.hset).toHaveBeenCalledWith('community:design:abc123DEF456', { featured: '0' });
  });
});
