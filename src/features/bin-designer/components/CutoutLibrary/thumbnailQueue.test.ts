import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';

const mocks = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  renders: [] as Array<{ resolve: (url: string) => void; id: string }>,
  files: new Set<string>(),
  arrive: null as null | ((hash: string) => void),
  status: 'idle',
  statusListeners: new Set<(state: { generation: { status: string } }) => void>(),
}));

vi.mock('@/features/bin-designer/store/designer', () => ({
  useDesignerStore: {
    getState: () => ({ generation: { status: mocks.status } }),
    subscribe: (listener: (state: { generation: { status: string } }) => void) => {
      mocks.statusListeners.add(listener);
      return () => mocks.statusListeners.delete(listener);
    },
  },
}));

vi.mock('@/shared/generation/meshStore', () => ({
  hasMeshFile: async (hash: string) => mocks.files.has(hash),
  subscribeMeshFileArrivals: (listener: (hash: string) => void) => {
    mocks.arrive = listener;
    return () => {
      mocks.arrive = null;
    };
  },
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
    mocks.files.clear();
    mocks.arrive = null;
    mocks.status = 'idle';
    mocks.statusListeners.clear();
  });

  it('waits for the editor to finish a build before it renders', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    mocks.status = 'generating';
    requestThumbnail(item('a'), vi.fn());
    await settle();
    await settle();
    expect(mocks.renders).toHaveLength(0);

    mocks.status = 'idle';
    for (const listener of mocks.statusListeners) listener({ generation: { status: 'idle' } });
    await settle();
    expect(mocks.renders.map((r) => r.id)).toEqual(['a']);
  });

  it('skips the render when every row that asked left during an editor build', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    mocks.status = 'generating';
    const cancel = requestThumbnail(item('a'), vi.fn());
    await settle();
    await settle();
    cancel();
    mocks.status = 'idle';
    for (const listener of mocks.statusListeners) listener({ generation: { status: 'idle' } });
    await settle();
    expect(mocks.renders).toHaveLength(0);
  });

  it('gives a second request for the item being drawn the same picture', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    const first = vi.fn();
    const second = vi.fn();
    requestThumbnail(item('a'), first);
    await settle();
    requestThumbnail(item('a'), second);
    await settle();
    mocks.renders[0].resolve('data:a');
    await settle();
    await settle();
    expect(mocks.renders).toHaveLength(1);
    expect(first).toHaveBeenCalledWith('data:a');
    expect(second).toHaveBeenCalledWith('data:a');
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

  it('waits for the mesh file of an imprint, and renders once it arrives', async () => {
    const { requestThumbnail } = await import('./thumbnailQueue');
    const hash = 'd'.repeat(64);
    const withMesh: CutoutLibraryItem = {
      ...item('m'),
      content: {
        params: {
          cutouts: [{ ...item('m').content.params.cutouts[0], shape: 'mesh', meshId: 'm1' }],
          meshAssets: {
            m1: { name: 'tool', hash, triangleCount: 4, sizeMm: { x: 1, y: 1, z: 1 }, bytes: 10 },
          },
        },
      },
    };
    const onReady = vi.fn();
    requestThumbnail(withMesh, onReady);
    await settle();
    await settle();
    expect(mocks.renders).toHaveLength(0);

    mocks.files.add(hash);
    mocks.arrive?.(hash);
    await settle();
    await settle();
    expect(mocks.renders.map((r) => r.id)).toEqual(['m']);
  });
});
