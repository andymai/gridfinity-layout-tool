import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';
import { SaveToLibraryDialog } from './SaveToLibraryDialog';

const stamp = '2026-11-22T00:00:00.000Z';
const folders: CutoutLibraryFolder[] = [
  { id: 'f1', name: 'Tools', parentId: null, createdAt: stamp, updatedAt: stamp },
  { id: 'f2', name: 'Sockets', parentId: 'f1', createdAt: stamp, updatedAt: stamp },
];
const source: CutoutLibraryItem = {
  id: 'clib_1',
  name: 'Wrench',
  folderId: 'f1',
  createdAt: stamp,
  updatedAt: stamp,
  content: { params: { cutouts: [] } },
};

describe('SaveToLibraryDialog', () => {
  it('saves a new item with the name and folder chosen', () => {
    const onSave = vi.fn();
    render(
      <SaveToLibraryDialog
        source={null}
        defaultName="Tape"
        folders={folders}
        saving={false}
        onSave={onSave}
        onCancel={() => {}}
      />
    );
    expect(screen.queryByText('Save as new')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Tape roll' } });
    fireEvent.change(screen.getByLabelText('Folder'), { target: { value: 'f2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ mode: 'new', name: 'Tape roll', folderId: 'f2' });
  });

  it('offers to update the item the selection came from, or to save a new one', () => {
    const onSave = vi.fn();
    render(
      <SaveToLibraryDialog
        source={source}
        defaultName="Wrench"
        folders={folders}
        saving={false}
        onSave={onSave}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith({ mode: 'update', name: 'Wrench', folderId: 'f1' });
    fireEvent.click(screen.getByText('Save as new'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith({ mode: 'new', name: 'Wrench', folderId: 'f1' });
  });
});
