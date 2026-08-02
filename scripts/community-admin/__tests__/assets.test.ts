import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityDesignRecord } from '../../../api/lib/communityStore';

const mocks = vi.hoisted(() => ({
  readCommunityDesignBlob: vi.fn(),
  deleteBlob: vi.fn(),
}));

vi.mock('../../../api/lib/communityStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/communityStore.js')>();
  return { ...actual, readCommunityDesignBlob: mocks.readCommunityDesignBlob };
});

vi.mock('../../../api/lib/blobStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lib/blobStore.js')>();
  return { ...actual, deleteBlob: mocks.deleteBlob };
});

const { purgeCommunityAssets } = await import('../lib/assets.js');

function record(overrides: Partial<CommunityDesignRecord> = {}): CommunityDesignRecord {
  return {
    id: 'abc123DEF456',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Someone',
    name: 'A bin',
    description: '',
    category: 'tools',
    techniques: [],
    params: {},
    metrics: { width: 42, depth: 42, height: 7, gridUnitMm: 42 },
    lineage: null,
    thumbnails: ['https://blob.test/thumb-0.webp', 'https://blob.test/thumb-1.webp'],
    meshUrl: 'https://blob.test/mesh.glb',
    photos: [],
    featured: false,
    createdAt: 1000,
    updatedAt: 1000,
    status: 'hidden',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteBlob.mockResolvedValue(undefined);
});

describe('purgeCommunityAssets', () => {
  it('enumerates and deletes every thumbnail and the mesh', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(record());
    await purgeCommunityAssets('abc123DEF456');
    expect(mocks.deleteBlob.mock.calls.map((call) => call[0])).toEqual([
      'https://blob.test/thumb-0.webp',
      'https://blob.test/thumb-1.webp',
      'https://blob.test/mesh.glb',
    ]);
  });

  it('skips empty asset URLs', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(record({ thumbnails: [''], meshUrl: '' }));
    await purgeCommunityAssets('abc123DEF456');
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });

  it('is a no-op when the record is gone', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(null);
    await purgeCommunityAssets('abc123DEF456');
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });

  it('fails loud when a delete errors', async () => {
    mocks.readCommunityDesignBlob.mockResolvedValue(record());
    mocks.deleteBlob.mockRejectedValueOnce(new Error('blob store down'));
    await expect(purgeCommunityAssets('abc123DEF456')).rejects.toThrow('blob store down');
  });
});
