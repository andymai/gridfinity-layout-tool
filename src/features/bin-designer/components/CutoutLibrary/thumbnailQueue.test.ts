import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';

const mocks = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  renders: [] as Array<{ resolve: (url: string) => void; id: string }>,
}));

vi.mock('@/features/bin-designer/library/CutoutLibraryService', () => ({
  getThumbnail: async (item: CutoutLibraryItem) => mocks.stored.get(item.id) ?? null,
  putThumbnail: async (item: CutoutLibraryItem, url: string) => {
    mocks.stored.set(item.id, url);
  },
}));
vi.mock('@/features/bin-designer/utils/thumbnailRegenerator', () => ({
  regenerateThumbnail: (params: { cutouts: Array<{ label: string }> }) =>
    new Promise<string>((resolve) => mocks.renders.push({ resolve, id: params.cutouts[0].label })),
}));

const item = (id: string): CutoutLibraryItem => ({
  id,
  name: id,
  folderId: null,
  createdAt: '2026-11-22T00:00:00.000Z',
  updatedAt: '2026-11-22T00:00:00.000Z',
  content: {
    params: {
      cutouts: [
        {
          id: 'a',
          shape: 'rectangle',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: id,
          groupId: null,
        },
      ],
    },
  },
});

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('requestThumbnail', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.stored.clear();
    mocks.renders.length = 0;
  });

  it('answers from the store without a render when this version has a picture', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    mocks.stored.set('a', 'data:stored');
    const onReady = vi.fn();
    requestThumbnail(item('a'), onReady);
    await settle();
    expect(onReady).toHaveBeenCalledWith('data:stored');
    expect(mocks.renders).toHaveLength(0);
  });

  it('renders one at a time, the newest request first, and keeps each picture', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    const readyA = vi.fn();
    const readyB = vi.fn();
    const readyC = vi.fn();
    requestThumbnail(item('a'), readyA);
    await settle();
    requestThumbnail(item('b'), readyB);
    requestThumbnail(item('c'), readyC);
    await settle();
    expect(mocks.renders.map((r) => r.id)).toEqual(['a']);

    mocks.renders[0].resolve('data:a');
    await settle();
    await settle();
    expect(readyA).toHaveBeenCalledWith('data:a');
    expect(mocks.renders.map((r) => r.id)).toEqual(['a', 'c']);
    expect(mocks.stored.get('a')).toBe('data:a');
  });

  it('drops a job nothing waits for any more', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    requestThumbnail(item('a'), vi.fn());
    await settle();
    const cancel = requestThumbnail(item('b'), vi.fn());
    await settle();
    cancel();
    mocks.renders[0].resolve('data:a');
    await settle();
    await settle();
    expect(mocks.renders.map((r) => r.id)).toEqual(['a']);
  });
});
