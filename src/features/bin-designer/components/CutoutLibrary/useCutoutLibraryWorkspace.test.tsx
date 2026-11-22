import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect, type ReactElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { expectOk } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useToastStore } from '@/core/store/toast';
import { closeLibraryDb } from '@/features/bin-designer/library/cutoutLibraryDb';
import { createItem, listItems } from '@/features/bin-designer/library/CutoutLibraryService';
import { __resetForTests } from '@/features/bin-designer/library/libraryEvents';
import { useCutoutLibraryStore } from '@/features/bin-designer/library/cutoutLibraryStore';
import type { MeshAssetRef } from '@/shared/generation/meshAsset';
import { contentBounds } from './libraryContent';
import {
  useCutoutLibraryWorkspace,
  type CutoutLibraryWorkspace,
} from './useCutoutLibraryWorkspace';

vi.mock('./thumbnailQueue', () => ({ requestThumbnail: () => () => {} }));
vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const shape = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 30,
  y: 20,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

let latest: CutoutLibraryWorkspace | null = null;
const selectIds = vi.fn();

function Harness({
  selection,
  isLid = false,
}: {
  selection: ReadonlySet<string>;
  isLid?: boolean;
}) {
  const params = useDesignerStore((s) => s.params);
  const lib = useCutoutLibraryWorkspace({
    cutouts: (isLid ? params.lid.cutouts : params.cutouts) ?? [],
    selection,
    groupNames: params.cutoutGroupNames,
    meshAssets: params.meshAssets,
    maxCutDepth: 20,
    isLid,
    binWidth: 80,
    binDepth: 80,
    grid: null,
    selectIds,
    panHeld: false,
    onBoardPress: () => {},
  });
  useEffect(() => {
    latest = lib;
  });
  return (
    <>
      {lib.panel}
      {lib.dialogs}
      {lib.hint}
    </>
  );
}

function dropAt(at: { x: number; y: number }) {
  const ghost = latest?.sceneOverlay as ReactElement<{ onDrop: (p: typeof at) => void }> | null;
  if (!ghost) throw new Error('no ghost');
  act(() => ghost.props.onDrop(at));
}

describe('useCutoutLibraryWorkspace', () => {
  beforeEach(async () => {
    closeLibraryDb();
    __resetForTests();
    latest = null;
    selectIds.mockClear();
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useCutoutLibraryStore.setState({ items: [], folders: [], loaded: false });
    useToastStore.setState({ toasts: [] });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-cutout-library-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('could not delete the test database'));
    });
  });

  it('saves the selection as a new item and marks the shapes it came from', async () => {
    useDesignerStore.getState().addCutout(shape('a', { label: 'Tape' }));
    render(<Harness selection={new Set(['a'])} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to library' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Tape');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await listItems()).toHaveLength(1));
    const [item] = await listItems();
    expect(contentBounds(item.content.params.cutouts)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 10,
    });
    await waitFor(() =>
      expect(useDesignerStore.getState().params.cutouts[0].libraryItemId).toBe(item.id)
    );
  });

  it('places an item where it is dropped, selects it, and puts the ghost away', async () => {
    const item = expectOk(
      await createItem({
        name: 'Wrench',
        folderId: null,
        content: { params: { cutouts: [shape('w')] } },
      })
    );
    render(<Harness selection={new Set()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Wrench/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Click the board to place Wrench.');
    dropAt({ x: 40, y: 40 });

    const placed = useDesignerStore.getState().params.cutouts;
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ x: 30, y: 35, libraryItemId: item.id });
    expect(selectIds).toHaveBeenCalledWith([placed[0].id], false);
    expect(latest?.sceneOverlay).toBeNull();
  });

  it('puts the ghost away on Esc', async () => {
    expectOk(
      await createItem({
        name: 'Wrench',
        folderId: null,
        content: { params: { cutouts: [shape('w')] } },
      })
    );
    render(<Harness selection={new Set()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Wrench/ }));
    expect(latest?.sceneOverlay).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(latest?.sceneOverlay).toBeNull();
  });

  it('places an item dragged from the tab, with no hint, and ends the drag on release', async () => {
    const item = expectOk(
      await createItem({
        name: 'Wrench',
        folderId: null,
        content: { params: { cutouts: [shape('w')] } },
      })
    );
    render(<Harness selection={new Set()} />);
    const row = await screen.findByRole('button', { name: /Wrench/ });

    fireEvent.pointerDown(row, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 0 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40 }));
    });
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const ghost = latest?.sceneOverlay as ReactElement<{ dragged: boolean }> | null;
    expect(ghost?.props.dragged).toBe(true);

    dropAt({ x: 40, y: 40 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 40 }));
    });
    expect(useDesignerStore.getState().params.cutouts[0]).toMatchObject({ libraryItemId: item.id });
    expect(latest?.sceneOverlay).toBeNull();
  });

  it('drops nothing when a drag ends off the board, and its click starts no placement', async () => {
    expectOk(
      await createItem({
        name: 'Wrench',
        folderId: null,
        content: { params: { cutouts: [shape('w')] } },
      })
    );
    render(<Harness selection={new Set()} />);
    const row = await screen.findByRole('button', { name: /Wrench/ });

    fireEvent.pointerDown(row, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 0 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 2 }));
    });
    fireEvent.click(row);

    expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
    expect(latest?.sceneOverlay).toBeNull();
    expect(row).toHaveAttribute('aria-pressed', 'false');
  });

  it('says why an imprint cannot go on the lid', async () => {
    const ref: MeshAssetRef = {
      name: 'tool',
      hash: 'c'.repeat(64),
      triangleCount: 10,
      sizeMm: { x: 10, y: 10, z: 10 },
      bytes: 10,
    };
    expectOk(
      await createItem({
        name: 'Pliers',
        folderId: null,
        content: {
          params: {
            cutouts: [shape('m', { shape: 'mesh', meshId: 'm1' })],
            meshAssets: { m1: ref },
          },
        },
      })
    );
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
    render(<Harness selection={new Set()} isLid />);
    fireEvent.click(await screen.findByRole('button', { name: /Pliers/ }));
    dropAt({ x: 40, y: 40 });
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain(
      'This item has an imprint, and imprints cannot go on a lid.'
    );
    expect(latest?.sceneOverlay).not.toBeNull();
  });
});
