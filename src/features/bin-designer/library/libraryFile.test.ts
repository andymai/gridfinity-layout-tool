import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { getStaticTranslation } from '@/i18n';
import type { TFunction } from '@/i18n';
import type { CutoutLibraryFolder, CutoutLibraryItem } from './libraryTypes';
import {
  exportLibraryFolderJSON,
  exportLibraryItemJSON,
  folderTree,
  importedMeshesUsable,
  parseLibraryFileJSON,
} from './libraryFile';

const t: TFunction = getStaticTranslation;

/** The item a file holds, or null when it is refused or is a folder. */
function parseLibraryItemJSON(json: string, translate: TFunction) {
  const parsed = parseLibraryFileJSON(json, translate);
  return parsed?.kind === 'item' ? parsed : null;
}

const cutout: Cutout = {
  id: 'a',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: 'Tape',
  groupId: 'g',
  groupOp: 'union',
};

describe('library item file', () => {
  it('reads back what it writes', () => {
    const json = exportLibraryItemJSON('Tape', {
      params: { cutouts: [cutout], cutoutGroupNames: { g: 'Roll' } },
    });
    const parsed = parseLibraryItemJSON(json, t);
    expect(parsed?.name).toBe('Tape');
    expect(parsed?.content.params.cutouts[0]).toMatchObject({
      width: 20,
      depth: 10,
      label: 'Tape',
    });
    expect(parsed?.content.params.cutoutGroupNames).toEqual({ g: 'Roll' });
  });

  it('drops placement-only fields', () => {
    const json = exportLibraryItemJSON('Tape', {
      params: { cutouts: [{ ...cutout, locked: true, libraryItemId: 'clib_1' }] },
    });
    const [c] = parseLibraryItemJSON(json, t)?.content.params.cutouts ?? [];
    expect(c.locked).toBeUndefined();
    expect(c.libraryItemId).toBeUndefined();
  });

  it('refuses a file that is not a library item', () => {
    expect(parseLibraryItemJSON('not json', t)).toBeNull();
    expect(
      parseLibraryItemJSON(JSON.stringify({ type: 'gridfinity-bin-design', params: {} }), t)
    ).toBeNull();
    const empty = JSON.parse(
      exportLibraryItemJSON('Empty', { params: { cutouts: [] } })
    ) as unknown;
    expect(parseLibraryItemJSON(JSON.stringify(empty), t)).toBeNull();
  });

  it('refuses a malformed cutout without throwing', () => {
    const type = 'gridfinity-cutout-library-item';
    const nulls = { type, params: { cutouts: [null] } };
    expect(parseLibraryItemJSON(JSON.stringify(nulls), t)).toBeNull();
    const odd = { type, params: { cutouts: [{ shape: 'path', path: 5 }] } };
    expect(() => parseLibraryItemJSON(JSON.stringify(odd), t)).not.toThrow();
    expect(parseLibraryItemJSON(JSON.stringify(odd), t)).toBeNull();
  });

  it('refuses a cutout without a size, and a mesh cutout without its mesh', () => {
    const type = 'gridfinity-cutout-library-item';
    const { width: _w, ...sizeless } = cutout;
    expect(
      parseLibraryItemJSON(JSON.stringify({ type, params: { cutouts: [sizeless] } }), t)
    ).toBeNull();
    const mesh = { ...cutout, shape: 'mesh', meshId: 'm1', groupId: null };
    expect(
      parseLibraryItemJSON(JSON.stringify({ type, params: { cutouts: [mesh] } }), t)
    ).toBeNull();
  });

  it('takes a file only when its meshes are inline and decode', async () => {
    const ref = {
      name: 'tool',
      hash: 'a'.repeat(64),
      triangleCount: 4,
      sizeMm: { x: 1, y: 1, z: 1 },
      bytes: 10,
    };
    expect(await importedMeshesUsable({ params: { cutouts: [cutout] } })).toBe(true);
    expect(
      await importedMeshesUsable({ params: { cutouts: [cutout], meshAssets: { m1: ref } } })
    ).toBe(false);
    const broken = {
      name: 'tool',
      data: 'not-a-mesh',
      triangleCount: 4,
      sizeMm: { x: 1, y: 1, z: 1 },
      outlines: [],
    };
    expect(
      await importedMeshesUsable({ params: { cutouts: [cutout], meshAssets: { m1: broken } } })
    ).toBe(false);
  });
});

const STAMP = '2026-11-22T00:00:00.000Z';
const folder = (id: string, name: string, parentId: string | null): CutoutLibraryFolder => ({
  id,
  name,
  parentId,
  createdAt: STAMP,
  updatedAt: STAMP,
});
const item = (id: string, name: string, folderId: string | null): CutoutLibraryItem => ({
  id,
  name,
  folderId,
  createdAt: STAMP,
  updatedAt: STAMP,
  content: { params: { cutouts: [{ ...cutout, groupId: null, groupOp: undefined }] } },
});

describe('library folder file', () => {
  const folders = [
    folder('tools', 'Tools', null),
    folder('drivers', 'Drivers', 'tools'),
    folder('bits', 'Bits', 'drivers'),
    folder('kitchen', 'Kitchen', null),
  ];
  const items = [
    item('i1', 'Wrench', 'tools'),
    item('i2', 'Stubby', 'drivers'),
    item('i3', 'Hex bit', 'bits'),
    item('i4', 'Whisk', 'kitchen'),
    item('i5', 'Loose', null),
  ];

  it('takes the folder and everything under it, parents first', () => {
    const tree = folderTree(folders[0], folders, items);
    expect(tree.name).toBe('Tools');
    expect(tree.folders).toEqual([
      { id: 'drivers', name: 'Drivers', parentId: null },
      { id: 'bits', name: 'Bits', parentId: 'drivers' },
    ]);
    expect(tree.items.map((i) => [i.name, i.folderId])).toEqual([
      ['Wrench', null],
      ['Stubby', 'drivers'],
      ['Hex bit', 'bits'],
    ]);
  });

  it('reads back what it writes', () => {
    const tree = folderTree(folders[0], folders, items);
    const parsed = parseLibraryFileJSON(exportLibraryFolderJSON(tree), t);
    expect(parsed?.kind).toBe('folder');
    if (parsed?.kind !== 'folder') return;
    expect(parsed.tree.name).toBe('Tools');
    expect(parsed.tree.folders).toEqual(tree.folders);
    expect(parsed.tree.items.map((i) => [i.name, i.folderId])).toEqual(
      tree.items.map((i) => [i.name, i.folderId])
    );
    expect(parsed.tree.items[0].content.params.cutouts[0]).toMatchObject({ width: 20 });
  });

  it('orders a hand-written file so each parent comes first', () => {
    const json = JSON.stringify({
      type: 'gridfinity-cutout-library-folder',
      version: '1.0',
      name: 'Shop',
      folders: [
        { id: 'b', name: 'Inner', parentId: 'a' },
        { id: 'a', name: 'Outer' },
      ],
      items: [],
    });
    const parsed = parseLibraryFileJSON(json, t);
    expect(parsed?.kind === 'folder' && parsed.tree.folders.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('reads a long chain of folders listed children first', () => {
    const folders = Array.from({ length: 5000 }, (_, i) => ({
      id: `f${i}`,
      parentId: i === 0 ? null : `f${i - 1}`,
    }));
    const json = JSON.stringify({
      type: 'gridfinity-cutout-library-folder',
      version: '1.0',
      folders: [...folders].reverse(),
      items: [],
    });
    // More folders than any library holds, which the parser says before reading items.
    expect(parseLibraryFileJSON(json, t)).toEqual({ kind: 'tooLarge', limit: 'folders' });
  });

  it('names the limit of a file that no library could take', () => {
    const file = (folders: unknown[], items: unknown[]) =>
      JSON.stringify({ type: 'gridfinity-cutout-library-folder', version: '1.0', folders, items });
    const chainOf = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `f${i}`,
        parentId: i === 0 ? null : `f${i - 1}`,
      }));
    const manyItems = Array.from({ length: 1001 }, () => ({ params: { cutouts: [cutout] } }));
    expect(parseLibraryFileJSON(file([], manyItems), t)).toEqual({
      kind: 'tooLarge',
      limit: 'items',
    });
    expect(parseLibraryFileJSON(file(chainOf(6), []), t)).toEqual({
      kind: 'tooLarge',
      limit: 'depth',
    });
    expect(parseLibraryFileJSON(file(chainOf(5), []), t)?.kind).toBe('folder');
  });

  it.each([
    ['a repeated folder id', [{ id: 'a' }, { id: 'a' }], []],
    ['a parent that is not in the file', [{ id: 'a', parentId: 'gone' }], []],
    [
      'parents that form a loop',
      [
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
      ],
      [],
    ],
    ['an item in a folder that is not in the file', [], [{ folderId: 'gone' }]],
    ['an item with no shapes', [], [{ params: { cutouts: [] } }]],
  ])('refuses %s', (_, rawFolders, rawItems) => {
    const json = JSON.stringify({
      type: 'gridfinity-cutout-library-folder',
      version: '1.0',
      folders: rawFolders,
      items: (rawItems as Record<string, unknown>[]).map((raw) => ({
        params: { cutouts: [cutout] },
        ...raw,
      })),
    });
    expect(parseLibraryFileJSON(json, t)).toBeNull();
  });
});
