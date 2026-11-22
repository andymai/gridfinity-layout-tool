import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAssetRef } from '@/shared/generation/meshAsset';
import {
  contentBounds,
  itemsOnBoard,
  placeLibraryContent,
  toLibraryContent,
} from './libraryContent';

function cutout(id: string, overrides: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 40,
    y: 30,
    width: 20,
    depth: 10,
    cutDepth: 8,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const ref: MeshAssetRef = {
  name: 'wrench',
  hash: 'b'.repeat(64),
  triangleCount: 10,
  sizeMm: { x: 1, y: 1, z: 1 },
  bytes: 10,
};

let counter = 0;
const ids = () => `new-${++counter}`;

describe('toLibraryContent', () => {
  it('moves the selection so its box starts at the origin', () => {
    const content = toLibraryContent([cutout('a'), cutout('b', { x: 70, y: 50 })], [], {});
    expect(contentBounds(content?.params.cutouts ?? [])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 30,
    });
  });

  it('keeps a group it holds whole, with its name, and lets go of one it holds in part', () => {
    const all = [
      cutout('a', { groupId: 'whole', groupOp: 'subtract', parentGroups: ['outer'] }),
      cutout('b', { groupId: 'whole', groupOp: 'subtract', parentGroups: ['outer'] }),
      cutout('c', { parentGroups: ['outer'] }),
    ];
    const content = toLibraryContent(all.slice(0, 2), all, {
      cutoutGroupNames: { whole: 'Pair', outer: 'Tray' },
    });
    const [a] = content?.params.cutouts ?? [];
    expect(a.groupId).toBe('whole');
    expect(a.groupOp).toBe('subtract');
    expect(a.parentGroups).toBeUndefined();
    expect(content?.params.cutoutGroupNames).toEqual({ whole: 'Pair' });
  });

  it('drops placement-only fields and carries only the meshes it names', () => {
    const content = toLibraryContent(
      [cutout('m', { shape: 'mesh', meshId: 'm1', locked: true, libraryItemId: 'clib_old' })],
      [],
      { meshAssets: { m1: ref, unused: ref } }
    );
    const [m] = content?.params.cutouts ?? [];
    expect(m.locked).toBeUndefined();
    expect(m.libraryItemId).toBeUndefined();
    expect(Object.keys(content?.params.meshAssets ?? {})).toEqual(['m1']);
  });

  it('is null for an empty selection', () => {
    expect(toLibraryContent([], [], {})).toBeNull();
  });
});

describe('placeLibraryContent', () => {
  const content = {
    params: {
      cutouts: [
        cutout('a', { x: 0, y: 0, groupId: 'g', parentGroups: ['p'], meshId: undefined }),
        cutout('b', { x: 30, y: 0, groupId: 'g', parentGroups: ['p'] }),
        cutout('m', { shape: 'mesh' as const, x: 0, y: 20, meshId: 'm1' }),
      ],
      cutoutGroupNames: { g: 'Pair', p: 'Tray' },
      meshAssets: { m1: ref },
    },
  };

  it('centres the item on the drop point', () => {
    const placed = placeLibraryContent(content, {
      itemId: 'clib_1',
      at: { x: 100, y: 100 },
      newCutoutId: ids,
      newGroupId: ids,
    });
    const box = contentBounds(placed.cutouts);
    expect(((box?.minX ?? 0) + (box?.maxX ?? 0)) / 2).toBeCloseTo(100, 9);
    expect(((box?.minY ?? 0) + (box?.maxY ?? 0)) / 2).toBeCloseTo(100, 9);
  });

  it('gives fresh ids to cutouts, groups and meshes, and keeps what they share', () => {
    const placed = placeLibraryContent(content, {
      itemId: 'clib_1',
      at: { x: 0, y: 0 },
      newCutoutId: ids,
      newGroupId: ids,
    });
    const [a, b, m] = placed.cutouts;
    expect(new Set(placed.cutouts.map((c) => c.id)).size).toBe(3);
    expect(['a', 'b', 'm']).not.toContain(a.id);
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupId).not.toBe('g');
    expect(a.parentGroups).toEqual(b.parentGroups);
    expect(placed.groupNames[a.groupId ?? '']).toBe('Pair');
    expect(placed.meshAssets[m.meshId ?? '']).toBe(ref);
    expect(placed.cutouts.every((c) => c.libraryItemId === 'clib_1')).toBe(true);
  });

  it('holds a fixed pocket to the depth its new bin can cut, and leaves a floor pocket', () => {
    const deep = {
      params: {
        cutouts: [
          cutout('a', { cutDepth: 30 }),
          cutout('b', { cutDepth: 30, depthMode: 'floor' as const }),
        ],
      },
    };
    const [a, b] = placeLibraryContent(deep, {
      itemId: 'clib_1',
      at: { x: 0, y: 0 },
      newCutoutId: ids,
      newGroupId: ids,
      maxCutDepth: 12,
    }).cutouts;
    expect(a.cutDepth).toBe(12);
    expect(b.cutDepth).toBe(30);
  });
});

describe('itemsOnBoard', () => {
  it('lists the items the board placed cutouts from', () => {
    const board = [
      cutout('a', { libraryItemId: 'clib_1' }),
      cutout('b'),
      cutout('c', { libraryItemId: 'clib_1' }),
    ];
    expect([...itemsOnBoard(board)]).toEqual(['clib_1']);
  });
});
