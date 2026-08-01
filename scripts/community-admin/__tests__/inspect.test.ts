import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityCardRecord, CommunityDesignRecord } from '../../../api/lib/communityStore';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  readCommunityDesignBlob: vi.fn(),
  readCommunityCards: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../../../api/lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/communityStore.js')>();
  return {
    ...actual,
    readCommunityDesignBlob: mocks.readCommunityDesignBlob,
    readCommunityCards: mocks.readCommunityCards,
  };
});

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
}));

const { inspect } = await import('../commands/inspect.js');

const RECORD = {
  id: 'abc123DEF456',
  name: 'Screwdriver tray',
  authorPublicId: 'author-pub-id',
  authorName: 'Jane',
  category: 'tools',
  techniques: [],
  lineage: null,
  featured: false,
  createdAt: 1,
  updatedAt: 1,
  status: 'live',
} as unknown as CommunityDesignRecord;

const CARD = { id: 'abc123DEF456', likes: 2, remixes: 0, exports: 1 } as CommunityCardRecord;

function baseArgs(positional: string[], json = false): Args {
  return { command: 'inspect', positional, json, yes: false, help: false };
}

function createRedis(reporterIds: string[]) {
  return {
    smembers: vi.fn(async () => reporterIds),
    quit: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inspect command', () => {
  it('requires an id', async () => {
    expect(await inspect(baseArgs([]))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects a malformed id before touching redis', async () => {
    expect(await inspect(baseArgs(['nope!']))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('exits 1 when neither the blob nor the card resolve', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(null);
    mocks.readCommunityCards.mockResolvedValue([null]);
    const redis = createRedis([]);
    mocks.connect.mockReturnValue(redis);

    expect(await inspect(baseArgs(['abc123DEF456']))).toBe(1);
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('emits the record, card, and reporters as JSON with --json', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(RECORD);
    mocks.readCommunityCards.mockResolvedValue([CARD]);
    const redis = createRedis(['user-7']);
    mocks.connect.mockReturnValue(redis);
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    expect(await inspect(baseArgs(['abc123DEF456'], true))).toBe(0);
    const payload = JSON.parse(write.mock.calls[0][0] as string) as {
      record: { id: string };
      card: { likes: number };
      reporterIds: string[];
    };
    expect(payload.record.id).toBe('abc123DEF456');
    expect(payload.card.likes).toBe(2);
    expect(payload.reporterIds).toEqual(['user-7']);
    write.mockRestore();
  });

  it('still reports card metadata when the blob is missing', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(null);
    mocks.readCommunityCards.mockResolvedValue([CARD]);
    const redis = createRedis([]);
    mocks.connect.mockReturnValue(redis);

    expect(await inspect(baseArgs(['abc123DEF456']))).toBe(0);
  });
});
