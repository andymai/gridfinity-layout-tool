import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LayoutFolder, LayoutLibrary } from '@/core/types';
import { layoutId } from '@/core/types';
import { FolderPickList } from './FolderPickList';

const folder = (id: string, name: string, parentId: string | null): LayoutFolder => ({
  id,
  name,
  parentId,
  createdAt: 1,
  modifiedAt: 1,
});

const library: LayoutLibrary = {
  version: '1.0',
  activeLayoutId: layoutId('a'),
  settings: {},
  entries: [],
  folders: [
    folder('study', 'Study', null),
    folder('desk', 'Desk', 'study'),
    folder('kitchen', 'Kitchen', null),
  ],
};

describe('FolderPickList', () => {
  it('lists the root first, then the tree in name order with children under parents', () => {
    render(<FolderPickList library={library} value={null} onPick={() => {}} />);
    const names = screen.getAllByRole('radio').map((r) => r.textContent?.trim());
    expect(names).toEqual(['No folder', 'Kitchen', 'Study', 'Desk']);
    expect(screen.getByRole('radio', { name: /No folder/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('picks a folder or the root', () => {
    const onPick = vi.fn();
    render(<FolderPickList library={library} value="desk" onPick={onPick} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Kitchen' }));
    expect(onPick).toHaveBeenCalledWith('kitchen');
    fireEvent.click(screen.getByRole('radio', { name: /No folder/ }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('disables a moving folder and its subtree as destinations', () => {
    render(
      <FolderPickList library={library} value={null} movingFolderId="study" onPick={() => {}} />
    );
    expect(screen.getByRole('radio', { name: 'Study' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Desk' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Kitchen' })).toBeEnabled();
  });
});
