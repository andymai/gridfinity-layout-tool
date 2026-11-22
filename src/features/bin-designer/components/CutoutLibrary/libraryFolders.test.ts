import { describe, it, expect } from 'vitest';
import type {
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';
import { folderOptions, folderRows, itemsIn, matchesQuery } from './libraryFolders';

const folder = (id: string, name: string, parentId: string | null): CutoutLibraryFolder => ({
  id,
  name,
  parentId,
  createdAt: '2026-11-22T00:00:00.000Z',
  updatedAt: '2026-11-22T00:00:00.000Z',
});

const item = (id: string, name: string, folderId: string | null): CutoutLibraryItem => ({
  id,
  name,
  folderId,
  createdAt: '2026-11-22T00:00:00.000Z',
  updatedAt: '2026-11-22T00:00:00.000Z',
  content: { params: { cutouts: [] } },
});

describe('folderRows', () => {
  it('lists folders in tree order with their depth', () => {
    const rows = folderRows([
      folder('s', 'Sockets', 't'),
      folder('t', 'Tools', null),
      folder('b', 'Bits', null),
    ]);
    expect(rows.map((r) => [r.folder.id, r.depth])).toEqual([
      ['b', 0],
      ['t', 0],
      ['s', 1],
    ]);
  });

  it('shows folders caught in a loop, each once', () => {
    const rows = folderRows([folder('a', 'A', 'b'), folder('b', 'B', 'a')]);
    expect(rows.map((r) => r.folder.id).sort()).toEqual(['a', 'b']);
  });

  it('shows a folder whose parent is missing at the top', () => {
    expect(folderRows([folder('s', 'Sockets', 'gone')]).map((r) => r.depth)).toEqual([0]);
  });
});

describe('itemsIn', () => {
  it('puts an item whose folder is missing at the top level', () => {
    const items = [item('a', 'A', 'gone'), item('b', 'B', 'f'), item('c', 'C', null)];
    expect(itemsIn(items, null, [folder('f', 'F', null)]).map((i) => i.id)).toEqual(['a', 'c']);
  });
});

describe('matchesQuery', () => {
  it('needs every word, in any case and order', () => {
    expect(matchesQuery(item('a', '10 mm Socket', null), 'socket 10')).toBe(true);
    expect(matchesQuery(item('a', '10 mm Socket', null), 'wrench')).toBe(false);
    expect(matchesQuery(item('a', 'Anything', null), '  ')).toBe(true);
  });
});

describe('folderOptions', () => {
  it('lists folders in tree order under the no-folder choice', () => {
    const options = folderOptions(
      [folder('s', 'Sockets', 't'), folder('t', 'Tools', null)],
      'No folder'
    );
    expect(options.map((o) => o.name)).toEqual([
      'No folder',
      'Tools',
      `${String.fromCharCode(0xa0, 0xa0)}Sockets`,
    ]);
    expect(options[0].id).toBe('');
  });
});
