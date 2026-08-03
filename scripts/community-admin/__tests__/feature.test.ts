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

function baseArgs(command: string, positional: string[], reason: string | null = null): Args {
  return { command, positional, json: false, yes: false, help: false, reason };
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

    expect(await feature(baseArgs('feature', ['abc123DEF456'], 'clever'))).toBe(1);
    expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
    expect(redis.hset).not.toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('feature sets the flag on both the blob and the card hash', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(RECORD);
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await feature(baseArgs('feature', ['abc123DEF456'], 'clever'))).toBe(0);
    const written = mocks.writeCommunityDesignBlob.mock.calls[0] as [
      CommunityDesignRecord,
      { allowOverwrite: boolean },
    ];
    expect(written[0].featured).toBe(true);
    // A15: featuring is not a content edit, so updatedAt must not move on
    // either the blob or the card hash (no updatedAt written to the hash).
    expect(written[0].updatedAt).toBe(RECORD.updatedAt);
    expect(written[1]).toEqual({ allowOverwrite: true });
    expect(written[0].featureReason).toBe('clever');
    expect(redis.hset).toHaveBeenCalledWith('community:design:abc123DEF456', {
      featured: '1',
      featureReason: 'clever',
    });
    expect(redis.hset).not.toHaveBeenCalledWith(
      'community:design:abc123DEF456',
      expect.objectContaining({ updatedAt: expect.anything() })
    );
  });

  it('unfeature clears the flag on both writers', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue({ ...RECORD, featured: true });
    const redis = createRedis();
    mocks.connect.mockReturnValue(redis);

    expect(await unfeature(baseArgs('unfeature', ['abc123DEF456']))).toBe(0);
    const written = mocks.writeCommunityDesignBlob.mock.calls[0][0] as CommunityDesignRecord;
    expect(written.featured).toBe(false);
    // Cleared on unfeature so a later re-feature cannot inherit a stale reason.
    expect(written.featureReason).toBe('');
    expect(redis.hset).toHaveBeenCalledWith('community:design:abc123DEF456', {
      featured: '0',
      featureReason: '',
    });
  });

  it('refuses to feature without a stated reason', async () => {
    // An unexplained star is the least legible signal in the gallery.
    expect(await feature(baseArgs('feature', ['abc123DEF456']))).toBe(2);
    expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
  });

  it('refuses a reason outside the closed set', async () => {
    expect(await feature(baseArgs('feature', ['abc123DEF456'], 'because-i-said-so'))).toBe(2);
    expect(mocks.writeCommunityDesignBlob).not.toHaveBeenCalled();
  });

  it('needs no reason to unfeature', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue({ ...RECORD, featured: true });
    mocks.connect.mockReturnValue(createRedis());

    expect(await unfeature(baseArgs('unfeature', ['abc123DEF456']))).toBe(0);
  });
});
