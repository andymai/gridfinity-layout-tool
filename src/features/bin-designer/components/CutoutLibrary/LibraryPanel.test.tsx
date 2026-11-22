import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { expectOk } from '@/test/testUtils';
import { closeLibraryDb } from '@/features/bin-designer/library/cutoutLibraryDb';
import { createFolder, createItem } from '@/features/bin-designer/library/CutoutLibraryService';
import { __resetForTests } from '@/features/bin-designer/library/libraryEvents';
import { useCutoutLibraryStore } from '@/features/bin-designer/library/cutoutLibraryStore';
import { LibraryPanel } from './LibraryPanel';

vi.mock('./thumbnailQueue', () => ({ requestThumbnail: () => () => {} }));

const shape = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'a',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});
const content = { params: { cutouts: [shape()] } };

function renderPanel(props: Partial<Parameters<typeof LibraryPanel>[0]> = {}) {
  const onPlace = vi.fn();
  render(
    <LibraryPanel
      cutouts={[]}
      canSave
      placingId={null}
      onSave={() => {}}
      onPlace={onPlace}
      onManage={() => {}}
      {...props}
    />
  );
  return { onPlace };
}

describe('LibraryPanel', () => {
  beforeEach(async () => {
    closeLibraryDb();
    __resetForTests();
    useCutoutLibraryStore.setState({ items: [], folders: [], loaded: false });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-cutout-library-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('could not delete the test database'));
    });
  });

  it('shows how to start when the library is empty, and needs a selection to save', async () => {
    renderPanel({ canSave: false });
    expect(await screen.findByText('No saved shapes yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to library' })).toBeDisabled();
  });

  it('lists the items this bin uses first, and places one on a click', async () => {
    const wrench = expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    expectOk(await createItem({ name: 'Allen keys', folderId: null, content }));
    const { onPlace } = renderPanel({ cutouts: [shape({ libraryItemId: wrench.id })] });

    expect(await screen.findByText('Used in this bin')).toBeInTheDocument();
    expect(screen.getAllByText('Wrench')).toHaveLength(2);
    expect(screen.getAllByText('Allen keys')).toHaveLength(1);
    expect(screen.getAllByText('20 × 10 mm · 1 shape').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Allen keys'));
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ name: 'Allen keys' }));
  });

  it('leaves out the used-here list when the bin uses every item', async () => {
    const wrench = expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    renderPanel({ cutouts: [shape({ libraryItemId: wrench.id })] });
    expect(await screen.findByText('Wrench')).toBeInTheDocument();
    expect(screen.queryByText('Used in this bin')).not.toBeInTheDocument();
  });

  it('keeps foldered items in their folder and finds them by search', async () => {
    const tools = expectOk(await createFolder('Tools', null));
    expectOk(await createItem({ name: '10 mm socket', folderId: tools.id, content }));
    renderPanel();

    expect(await screen.findByText('Tools')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /10 mm socket/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search the library' }), {
      target: { value: 'socket' },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /10 mm socket/ })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Search the library' }), {
      target: { value: 'wrench' },
    });
    expect(screen.getByText('No items match your search')).toBeInTheDocument();
  });
});
