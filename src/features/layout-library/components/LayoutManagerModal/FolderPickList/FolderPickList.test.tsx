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

  it('keeps one row in the tab order and walks the enabled rows with the arrow keys', () => {
    const onPick = vi.fn();
    render(
      <FolderPickList library={library} value="study" movingFolderId="kitchen" onPick={onPick} />
    );
    const radios = screen.getAllByRole('radio');
    expect(
      radios.filter((r) => r.getAttribute('tabindex') === '0').map((r) => r.textContent)
    ).toEqual(['Study']);
    const study = screen.getByRole('radio', { name: 'Study' });
    fireEvent.keyDown(study, { key: 'ArrowDown' });
    expect(onPick).toHaveBeenLastCalledWith('desk');
    fireEvent.keyDown(study, { key: 'ArrowUp' });
    // Kitchen is disabled, so up from Study lands on the root.
    expect(onPick).toHaveBeenLastCalledWith(null);
    fireEvent.keyDown(study, { key: 'End' });
    expect(onPick).toHaveBeenLastCalledWith('desk');
    fireEvent.keyDown(study, { key: 'Home' });
    expect(onPick).toHaveBeenLastCalledWith(null);
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
