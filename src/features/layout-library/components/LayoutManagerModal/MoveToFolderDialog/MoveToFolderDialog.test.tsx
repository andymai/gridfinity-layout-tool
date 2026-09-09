import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('stays inert while a move is in flight', async () => {
    let finish: () => void = () => {};
    const onMove = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <MoveToFolderDialog
        open
        library={library}
        name="X"
        currentFolderId={null}
        onClose={() => {}}
        onMove={onMove}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Desk' }));
    const move = screen.getByRole('button', { name: 'Move' });
    fireEvent.click(move);
    fireEvent.click(move);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => {
      finish();
    });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('follows a folder change made elsewhere while open', () => {
    const { rerender } = render(
      <MoveToFolderDialog
        open
        library={library}
        name="X"
        currentFolderId={null}
        onClose={() => {}}
        onMove={() => {}}
      />
    );
    rerender(
      <MoveToFolderDialog
        open
        library={library}
        name="X"
        currentFolderId="desk"
        onClose={() => {}}
        onMove={() => {}}
      />
    );
    expect(screen.getByRole('radio', { name: 'Desk' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
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
