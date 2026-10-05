import { describe, it, expect, vi } from 'vitest';
import { layoutId } from '@/core/types';
import type { LayoutEntry, LayoutPreview } from '@/core/types';
import { designOwner, layoutsUsingDesign, ownedCopyId, ownedCopyName } from './designOwnership';

const preview = (baseplateId?: string | null): LayoutPreview =>
  ({
    drawerWidth: 4,
    drawerDepth: 4,
    drawerHeight: 7,
    binCount: 0,
    layerCount: 1,
    ...(baseplateId !== undefined ? { baseplateId } : {}),
  }) as LayoutPreview;

const entry = (id: string, createdAt: number, baseplateId?: string | null): LayoutEntry => ({
  id: layoutId(id),
  name: `Layout ${id}`,
  createdAt,
  modifiedAt: createdAt,
  preview: preview(baseplateId),
});

describe('layoutsUsingDesign', () => {
  it('reads links from entry previews', async () => {
    const readLink = vi.fn();
    const users = await layoutsUsingDesign(
      'X',
      [entry('a', 1, 'X'), entry('b', 2, 'Y'), entry('c', 3, null)],
      readLink
    );
    expect(users.map((u) => u.id)).toEqual(['a']);
    expect(readLink).not.toHaveBeenCalled();
  });

  it('reads the stored layout for an entry saved before previews recorded the link', async () => {
    const readLink = vi.fn().mockResolvedValue('X');
    const users = await layoutsUsingDesign('X', [entry('old', 1)], readLink);
    expect(users.map((u) => u.id)).toEqual(['old']);
    expect(readLink).toHaveBeenCalledWith(layoutId('old'));
  });

  it('takes the open layout’s live link over its trailing entry', async () => {
    const users = await layoutsUsingDesign(
      'X',
      [entry('open', 1, 'Y'), entry('other', 2, 'X')],
      vi.fn(),
      { id: layoutId('open'), name: 'Open', designId: 'X' }
    );
    expect(users.map((u) => u.id)).toEqual(['open', 'other']);
  });
});

describe('designOwner', () => {
  it('is the oldest layout', () => {
    const owner = designOwner([
      { id: layoutId('dup'), name: 'Copy', createdAt: 20 },
      { id: layoutId('src'), name: 'Source', createdAt: 10 },
    ]);
    expect(owner?.id).toBe(layoutId('src'));
  });

  it('breaks a createdAt tie by id, so every device picks the same owner', () => {
    const users = [
      { id: layoutId('b'), name: 'B', createdAt: 5 },
      { id: layoutId('a'), name: 'A', createdAt: 5 },
    ];
    expect(designOwner(users)?.id).toBe(layoutId('a'));
    expect(designOwner([...users].reverse())?.id).toBe(layoutId('a'));
  });
});

describe('ownedCopyId', () => {
  it('is stable for a layout and design, and differs across layouts', () => {
    const a = ownedCopyId(layoutId('a'), 'baseplate_1_x');
    expect(ownedCopyId(layoutId('a'), 'baseplate_1_x')).toBe(a);
    expect(ownedCopyId(layoutId('b'), 'baseplate_1_x')).not.toBe(a);
  });

  it('matches the id format baseplate sync accepts', () => {
    expect(ownedCopyId(layoutId('a'), 'baseplate_1_x')).toMatch(/^baseplate_\d+_[a-z0-9]{1,8}$/);
  });
});

describe('ownedCopyName', () => {
  it('names the copy after the design and the layout', () => {
    expect(ownedCopyName('Baseplate 1', 'Kitchen drawer')).toBe('Baseplate 1 (Kitchen drawer)');
  });

  it('stays within the 64-character name limit', () => {
    const name = ownedCopyName('B'.repeat(40), 'L'.repeat(40));
    expect(name).toHaveLength(64);
    expect(name.endsWith('…')).toBe(true);
  });
});
