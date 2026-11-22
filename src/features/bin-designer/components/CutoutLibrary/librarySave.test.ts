import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { defaultSaveName, saveSource } from './librarySave';

const cutout = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const item: CutoutLibraryItem = {
  id: 'clib_1',
  name: 'Sockets',
  folderId: null,
  createdAt: '2026-11-22T00:00:00.000Z',
  updatedAt: '2026-11-22T00:00:00.000Z',
  content: { params: { cutouts: [] } },
};

describe('saveSource', () => {
  it('finds the item every chosen cutout came from', () => {
    const chosen = [
      cutout('a', { libraryItemId: 'clib_1' }),
      cutout('b', { libraryItemId: 'clib_1' }),
    ];
    expect(saveSource(chosen, [item])).toBe(item);
  });

  it('is null when the cutouts disagree, carry no item, or name a deleted one', () => {
    expect(saveSource([cutout('a', { libraryItemId: 'clib_1' }), cutout('b')], [item])).toBeNull();
    expect(saveSource([cutout('a')], [item])).toBeNull();
    expect(saveSource([cutout('a', { libraryItemId: 'clib_gone' })], [item])).toBeNull();
  });
});

describe('defaultSaveName', () => {
  it('prefers the source item, then a shared group name, then a label', () => {
    expect(defaultSaveName([cutout('a')], item, {}, 'Saved')).toBe('Sockets');
    const grouped = [cutout('a', { groupId: 'g' }), cutout('b', { groupId: 'g' })];
    expect(defaultSaveName(grouped, null, { g: ' Pliers ' }, 'Saved')).toBe('Pliers');
    expect(defaultSaveName([cutout('a', { label: 'Tape' })], null, {}, 'Saved')).toBe('Tape');
    expect(defaultSaveName([cutout('a'), cutout('b')], null, {}, 'Saved')).toBe('Saved');
  });
});
