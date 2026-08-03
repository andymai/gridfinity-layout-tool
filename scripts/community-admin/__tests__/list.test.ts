import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityCardRecord } from '../../../api/lib/communityStore';
import type { Args } from '../lib/args';

const mocks = vi.hoisted(() => ({
  readCommunityCards: vi.fn(),
  connect: vi.fn(),
  scanKeys: vi.fn(),
}));

vi.mock('../../../api/lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/communityStore.js')>();
  return {
    ...actual,
    readCommunityCards: mocks.readCommunityCards,
  };
});

vi.mock('../lib/redis.js', () => ({
  connect: mocks.connect,
  scanKeys: mocks.scanKeys,
}));

const { list } = await import('../commands/list.js');

function card(id: string, status: CommunityCardRecord['status']): CommunityCardRecord {
  return {
    id,
    name: `Design ${id}`,
    parentId: '',
    authorPublicId: 'author-pub-id',
    authorName: 'Jane',
    category: 'tools',
    techniques: [],
    width: 2,
    depth: 2,
    height: 2,
    gridUnitMm: 42,
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    createdAt: 1,
    updatedAt: 1,
    status,
    likes: 0,
    remixes: 0,
    exports: 0,
  };
}

function baseArgs(positional: string[], json = false): Args {
  return { command: 'list', positional, json, yes: false, help: false, reason: null };
}

function createRedis(reportCounts: number[]) {
  const pipeline = {
    scard: vi.fn(() => pipeline),
    exec: vi.fn(async () => reportCounts.map((count) => [null, count])),
  };
  return {
    pipeline: vi.fn(() => pipeline),
    quit: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('list command', () => {
  it('rejects an unknown mode without connecting', async () => {
    expect(await list(baseArgs(['everything']))).toBe(2);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('counts by status and filters flagged to reported live designs', async () => {
    mocks.scanKeys.mockResolvedValue([
      'community:design:live-quiet',
      'community:design:live-flagged',
      'community:design:hidden-one',
    ]);
    mocks.readCommunityCards.mockResolvedValue([
      card('live-quiet', 'live'),
      card('live-flagged', 'live'),
      card('hidden-one', 'hidden'),
    ]);
    const redis = createRedis([0, 3, 1]);
    mocks.connect.mockReturnValue(redis);
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    expect(await list(baseArgs(['flagged'], true))).toBe(0);
    const payload = JSON.parse(write.mock.calls[0][0] as string) as {
      counts: { live: number; hidden: number; removed: number; flagged: number };
      designs: Array<{ id: string; reportCount: number }>;
    };
    expect(payload.counts).toEqual({ live: 2, hidden: 1, removed: 0, flagged: 1 });
    expect(payload.designs.map((design) => design.id)).toEqual(['live-flagged']);
    expect(payload.designs[0].reportCount).toBe(3);
    write.mockRestore();
  });

  it('lists hidden designs in hidden mode', async () => {
    mocks.scanKeys.mockResolvedValue(['community:design:a', 'community:design:b']);
    mocks.readCommunityCards.mockResolvedValue([card('a', 'live'), card('b', 'hidden')]);
    const redis = createRedis([0, 0]);
    mocks.connect.mockReturnValue(redis);
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    expect(await list(baseArgs(['hidden'], true))).toBe(0);
    const payload = JSON.parse(write.mock.calls[0][0] as string) as {
      designs: Array<{ id: string }>;
    };
    expect(payload.designs.map((design) => design.id)).toEqual(['b']);
    write.mockRestore();
  });
});
