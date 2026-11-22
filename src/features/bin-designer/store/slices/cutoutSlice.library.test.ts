import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';
import { MAX_LID_CUTOUTS } from '@/features/bin-designer/types';
import type { MeshAssetRef } from '@/shared/generation/meshAsset';
import { MAX_MESH_TRIANGLES_PER_DESIGN } from '@/shared/generation/meshAsset';

function cutout(id: string, overrides: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const ref = (triangleCount: number): MeshAssetRef => ({
  name: 'tool',
  hash: 'a'.repeat(64),
  triangleCount,
  sizeMm: { x: 10, y: 10, z: 10 },
  bytes: 100,
});

describe('addLibraryCutouts', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('adds every cutout with its group names in one undo step', () => {
    const store = useDesignerStore.getState();
    store.addCutout(cutout('existing', { zIndex: 4 }));
    const before = useDesignerStore.getState().history.past.length;

    const added = useDesignerStore
      .getState()
      .addLibraryCutouts(
        [cutout('a', { groupId: 'g', zIndex: 0 }), cutout('b', { groupId: 'g', zIndex: 1 })],
        {},
        { g: 'Sockets' }
      );

    const { params, history } = useDesignerStore.getState();
    expect(added).toBe('added');
    expect(history.past.length).toBe(before + 1);
    expect(params.cutoutGroupNames).toEqual({ g: 'Sockets' });
    const placed = params.cutouts.filter((c) => c.id !== 'existing');
    expect(placed.map((c) => c.zIndex)).toEqual([5, 6]);
  });

  it('adds the mesh assets its imprints name', () => {
    useDesignerStore
      .getState()
      .addLibraryCutouts(
        [cutout('m', { shape: 'mesh', meshId: 'mesh-1' })],
        { 'mesh-1': ref(10) },
        {}
      );
    expect(useDesignerStore.getState().params.meshAssets?.['mesh-1']).toBeDefined();
  });

  it('adds nothing past the triangle budget', () => {
    const added = useDesignerStore
      .getState()
      .addLibraryCutouts(
        [cutout('m', { shape: 'mesh', meshId: 'mesh-1' })],
        { 'mesh-1': ref(MAX_MESH_TRIANGLES_PER_DESIGN + 1) },
        {}
      );
    expect(added).toBe('overBudget');
    expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
  });

  it('puts nothing on a lid that has no room for all of it', () => {
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
    const many = Array.from({ length: MAX_LID_CUTOUTS + 1 }, (_, i) => cutout(`c${i}`));
    expect(useDesignerStore.getState().addLibraryCutouts(many, {}, {})).toBe('noRoom');
    expect(useDesignerStore.getState().params.lid.cutouts).toBeUndefined();
  });

  it('keeps a mesh imprint off the lid', () => {
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
    const added = useDesignerStore
      .getState()
      .addLibraryCutouts(
        [cutout('m', { shape: 'mesh', meshId: 'mesh-1' })],
        { 'mesh-1': ref(10) },
        {}
      );
    expect(added).toBe('meshOnLid');
  });
});

describe('setCutoutsLibraryItem', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('tags the cutouts without a rebuild, and does nothing when they carry the tag', () => {
    const store = useDesignerStore.getState();
    store.addCutout(cutout('a'));
    store.addCutout(cutout('b'));
    const { epoch } = useDesignerStore.getState().generation;
    const before = useDesignerStore.getState().history.past.length;

    useDesignerStore.getState().setCutoutsLibraryItem(['a'], 'clib_1');
    useDesignerStore.getState().setCutoutsLibraryItem(['a'], 'clib_1');

    const state = useDesignerStore.getState();
    expect(state.params.cutouts.map((c) => c.libraryItemId)).toEqual(['clib_1', undefined]);
    expect(state.generation.epoch).toBe(epoch);
    expect(state.history.past.length).toBe(before + 1);
  });
});
