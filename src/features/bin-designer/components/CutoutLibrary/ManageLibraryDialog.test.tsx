import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expectOk } from '@/test/testUtils';
import { closeLibraryDb } from '@/features/bin-designer/library/cutoutLibraryDb';
import {
  createFolder,
  createItem,
  listFolders,
  listItems,
} from '@/features/bin-designer/library/CutoutLibraryService';
import { __resetForTests } from '@/features/bin-designer/library/libraryEvents';
import { useCutoutLibraryStore } from '@/features/bin-designer/library/cutoutLibraryStore';
import {
  exportLibraryFolderJSON,
  exportLibraryItemJSON,
} from '@/features/bin-designer/library/libraryFile';
import { useToastStore } from '@/core/store/toast';
import { ManageLibraryDialog } from './ManageLibraryDialog';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));
const delivered = vi.hoisted(() => [] as { blob: Blob; name: string }[]);
vi.mock('@/shared/exportDestination/deliverExport', () => ({
  deliverExport: (blob: Blob, name: string) => {
    delivered.push({ blob, name });
    return Promise.resolve(true);
  },
}));
vi.mock('@/shared/exportDestination/exportFolder', () => ({ primeExportFolder: () => {} }));

const toasts = () => useToastStore.getState().toasts.map((toast) => toast.message);

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
    delivered.length = 0;
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
      expect(toasts()).toContain('This file is not a cutout library item or folder.')
    );
  });

  it('imports a folder file whole, under a new top-level folder', async () => {
    render(<ManageLibraryDialog onClose={() => {}} />);
    const json = exportLibraryFolderJSON({
      name: 'Tools',
      folders: [{ id: 'd', name: 'Drivers', parentId: null }],
      items: [{ name: 'Stubby', folderId: 'd', content }],
    });
    fireEvent.change(await screen.findByTestId('library-import-input'), {
      target: { files: [new File([json], 'tools.cutouts.json')] },
    });

    await waitFor(() => expect(toasts()).toContain('Added the folder Tools to the library'));
    const folders = await listFolders();
    const tools = folders.find((f) => f.name === 'Tools');
    const drivers = folders.find((f) => f.name === 'Drivers');
    expect(tools?.parentId).toBeNull();
    expect(drivers?.parentId).toBe(tools?.id);
    expect((await listItems()).map((i) => [i.name, i.folderId])).toEqual([['Stubby', drivers?.id]]);
  });

  it('refuses a folder file that nests too deep, and adds nothing', async () => {
    render(<ManageLibraryDialog onClose={() => {}} />);
    const folders = Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`,
      name: `Level ${i}`,
      parentId: i === 0 ? null : `f${i - 1}`,
    }));
    const json = exportLibraryFolderJSON({ name: 'Deep', folders, items: [] });
    fireEvent.change(await screen.findByTestId('library-import-input'), {
      target: { files: [new File([json], 'deep.cutouts.json')] },
    });

    await waitFor(() =>
      expect(toasts()).toContain('The folders in this file nest more than 6 levels deep.')
    );
    expect(await listFolders()).toEqual([]);
  });

  it('exports a folder with the folders and items inside it', async () => {
    const tools = expectOk(await createFolder('Tools', null));
    const drivers = expectOk(await createFolder('Drivers', tools.id));
    expectOk(await createItem({ name: 'Stubby', folderId: drivers.id, content }));
    expectOk(await createItem({ name: 'Elsewhere', folderId: null, content }));
    render(<ManageLibraryDialog onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Export folder Tools' }));

    await waitFor(() => expect(delivered).toHaveLength(1));
    expect(delivered[0].name).toBe('Tools.cutouts.json');
    const file = JSON.parse(await delivered[0].blob.text()) as {
      type: string;
      folders: { name: string; parentId: string | null }[];
      items: { name: string; folderId: string | null }[];
    };
    expect(file.type).toBe('gridfinity-cutout-library-folder');
    expect(file.folders).toEqual([{ id: drivers.id, name: 'Drivers', parentId: null }]);
    expect(file.items.map((i) => [i.name, i.folderId])).toEqual([['Stubby', drivers.id]]);
  });
});
