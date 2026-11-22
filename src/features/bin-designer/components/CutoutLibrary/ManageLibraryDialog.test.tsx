import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expectOk } from '@/test/testUtils';
import { closeLibraryDb } from '@/features/bin-designer/library/cutoutLibraryDb';
import {
  createItem,
  listFolders,
  listItems,
} from '@/features/bin-designer/library/CutoutLibraryService';
import { __resetForTests } from '@/features/bin-designer/library/libraryEvents';
import { useCutoutLibraryStore } from '@/features/bin-designer/library/cutoutLibraryStore';
import { exportLibraryItemJSON } from '@/features/bin-designer/library/libraryFile';
import { useToastStore } from '@/core/store/toast';
import { ManageLibraryDialog } from './ManageLibraryDialog';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const content = {
  params: {
    cutouts: [
      {
        id: 'a',
        shape: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 20,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      },
    ],
  },
};

describe('ManageLibraryDialog', () => {
  beforeEach(async () => {
    closeLibraryDb();
    __resetForTests();
    useCutoutLibraryStore.setState({ items: [], folders: [], loaded: false });
    useToastStore.setState({ toasts: [] });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-cutout-library-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('could not delete the test database'));
    });
  });

  it('makes a folder and deletes an item only once the delete is confirmed', async () => {
    expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    render(<ManageLibraryDialog onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'New folder' }));
    await waitFor(async () => expect(await listFolders()).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Wrench' }));
    expect(screen.getByText('Delete Wrench? This cannot be undone.')).toBeInTheDocument();
    expect(await listItems()).toHaveLength(1);
    const confirm = screen.getAllByRole('button', { name: 'Delete' }).at(-1);
    if (confirm) fireEvent.click(confirm);
    await waitFor(async () => expect(await listItems()).toHaveLength(0));
  });

  it('imports an item file and refuses a file that is not one', async () => {
    render(<ManageLibraryDialog onClose={() => {}} />);
    const input = await screen.findByTestId('library-import-input');

    const good = new File([exportLibraryItemJSON('Tape', content)], 'tape.cutouts.json');
    fireEvent.change(input, { target: { files: [good] } });
    await waitFor(async () => expect((await listItems()).map((i) => i.name)).toEqual(['Tape']));

    const bad = new File(['{"type":"something-else"}'], 'other.json');
    fireEvent.change(input, { target: { files: [bad] } });
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'This file is not a cutout library item.'
      )
    );
  });
});
