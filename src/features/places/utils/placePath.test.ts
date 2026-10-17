import { describe, expect, it } from 'vitest';
import type { LayoutEntry, LayoutFolder, LayoutLibrary } from '@/core/types';
import { layoutId } from '@/core/types';
import { placePath } from './placePath';

const folder = (
  id: string,
  name: string,
  parentId: string | null,
  kind?: LayoutFolder['kind']
) => ({
  id,
  name,
  parentId,
  kind,
  createdAt: 1,
  modifiedAt: 1,
});
const entry = (id: string, folderId: string | null) =>
  ({ id: layoutId(id), name: id, createdAt: 1, modifiedAt: 1, folderId }) as unknown as LayoutEntry;

const library: LayoutLibrary = {
  version: '1.0',
  activeLayoutId: layoutId('drawer'),
  settings: {},
  entries: [
    entry('drawer', 'toolbox'),
    entry('loose', null),
    entry('bench', 'bench-1'),
    entry('lost', 'gone'),
  ],
  folders: [
    folder('kitchen', 'Kitchen', null),
    folder('toolbox', 'Red toolbox', 'kitchen', 'unit'),
    folder('shop', 'Shop', null, 'place'),
    folder('bench-1', 'Bench', 'shop'),
  ],
};

describe('placePath', () => {
  it('puts a layout outside every place in My place', () => {
    expect(placePath(library, layoutId('drawer'), 'My place')).toEqual([
      'My place',
      'Kitchen',
      'Red toolbox',
    ]);
    expect(placePath(library, layoutId('loose'), 'My place')).toEqual(['My place']);
  });

  it('starts at the place a layout sits in', () => {
    expect(placePath(library, layoutId('bench'), 'My place')).toEqual(['Shop', 'Bench']);
  });

  it('reads a missing folder as the root, and an unknown layout as nowhere', () => {
    expect(placePath(library, layoutId('lost'), 'My place')).toEqual(['My place']);
    expect(placePath(library, layoutId('nope'), 'My place')).toEqual([]);
    expect(placePath(library, null, 'My place')).toEqual([]);
  });
});
