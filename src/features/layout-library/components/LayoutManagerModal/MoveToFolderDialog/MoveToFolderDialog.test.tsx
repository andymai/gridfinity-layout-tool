import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LayoutFolder, LayoutLibrary } from '@/core/types';
import { layoutId } from '@/core/types';
import { MoveToFolderDialog } from './MoveToFolderDialog';

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
  folders: [folder('study', 'Study', null), folder('desk', 'Desk', 'study')],
};

describe('MoveToFolderDialog', () => {
  it('names what is moving and only enables Move once the destination changes', () => {
    const onMove = vi.fn();
    render(
      <MoveToFolderDialog
        open
        library={library}
        name="Top drawer"
        currentFolderId="study"
        onClose={() => {}}
        onMove={onMove}
      />
    );
    expect(screen.getByText('Move "Top drawer"')).toBeInTheDocument();
    const move = screen.getByRole('button', { name: 'Move' });
    expect(move).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Desk' }));
    expect(move).toBeEnabled();
    fireEvent.click(move);
    expect(onMove).toHaveBeenCalledWith('desk');
  });

  it('can move out to the root', () => {
    const onMove = vi.fn();
    render(
      <MoveToFolderDialog
        open
        library={library}
        name="X"
        currentFolderId="desk"
        onClose={() => {}}
        onMove={onMove}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: /No folder/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(onMove).toHaveBeenCalledWith(null);
  });
});
