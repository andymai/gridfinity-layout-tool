import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LayoutEntry, LayoutFolder, LayoutLibrary } from '@/core/types';
import { gridUnits, heightUnits, layoutId } from '@/core/types';
import { FolderTree } from './FolderTree';

const folder = (id: string, name: string, parentId: string | null): LayoutFolder => ({
  id,
  name,
  parentId,
  createdAt: 1,
  modifiedAt: 1,
});

const entry = (id: string, folderId: string | null): LayoutEntry => ({
  id: layoutId(id),
  name: id,
  createdAt: 1,
  modifiedAt: 1,
  preview: {
    drawerWidth: gridUnits(4),
    drawerDepth: gridUnits(4),
    drawerHeight: heightUnits(7),
    binCount: 0,
    layerCount: 1,
  },
  folderId,
});

const library: LayoutLibrary = {
  version: '1.0',
  activeLayoutId: layoutId('a'),
  settings: {},
  entries: [entry('a', null), entry('b', 'desk'), entry('c', 'desk')],
  folders: [folder('study', 'Study', null), folder('desk', 'Desk', 'study')],
};

const noop = () => {};

describe('FolderTree', () => {
  it('lists every layout, then the top-level folders with their counts, collapsed', () => {
    render(
      <FolderTree
        library={library}
        selectedId={null}
        onSelect={noop}
        onCreate={noop}
        onRename={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByRole('treeitem', { name: /All layouts/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Open folder Study' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open folder Desk' })).not.toBeInTheDocument();
  });

  it('opens the ancestors of the selected folder', () => {
    render(
      <FolderTree
        library={library}
        selectedId="desk"
        onSelect={noop}
        onCreate={noop}
        onRename={noop}
        onDelete={noop}
      />
    );
    const desk = screen.getByRole('button', { name: 'Open folder Desk' });
    expect(desk).toBeInTheDocument();
    expect(desk).toHaveTextContent('2');
  });

  it('selects on click and expands on the chevron', () => {
    const onSelect = vi.fn();
    render(
      <FolderTree
        library={library}
        selectedId={null}
        onSelect={onSelect}
        onCreate={noop}
        onRename={noop}
        onDelete={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open folder Study' }));
    expect(onSelect).toHaveBeenCalledWith('study');
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByRole('button', { name: 'Open folder Desk' })).toBeInTheDocument();
  });

  it('creates a folder under the selection from the draft row', () => {
    const onCreate = vi.fn();
    render(
      <FolderTree
        library={library}
        selectedId="study"
        onSelect={noop}
        onCreate={onCreate}
        onRename={noop}
        onDelete={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
    const input = screen.getByRole('textbox', { name: 'Folder name' });
    fireEvent.change(input, { target: { value: 'Cupboard' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledWith('Cupboard', 'study');
  });

  it('renames inline and deletes on the second click', () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(
      <FolderTree
        library={library}
        selectedId="study"
        onSelect={noop}
        onCreate={noop}
        onRename={onRename}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename folder: Study' }));
    const input = screen.getByRole('textbox', { name: 'Rename folder' });
    fireEvent.change(input, { target: { value: 'Office' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('study', 'Office');

    fireEvent.click(screen.getByRole('button', { name: 'Delete folder: Study' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete?: Study' }));
    expect(onDelete).toHaveBeenCalledWith('study');
  });
});
