// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ok } from '@/core/result';
import { designId } from '@/core/types';
import type { ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';
import type { SavedDesign } from '../types';
import { useDesignerStore } from '../store';

const loadDesignMock = vi.fn();
const saveDesignMock = vi.fn();
const updateDesignThumbnailMock = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  loadDesign: (...args: unknown[]) => loadDesignMock(...args),
  saveDesign: (...args: unknown[]) => saveDesignMock(...args),
  updateDesignThumbnail: (...args: unknown[]) => updateDesignThumbnailMock(...args),
}));

const upsertRegistryEntryMock = vi.fn();
vi.mock('../store/customBinRegistry', async (importOriginal) => {
  const original = await importOriginal<object>();
  return {
    ...original,
    upsertRegistryEntry: (ref: unknown) => upsertRegistryEntryMock(ref),
  };
});

const captureThumbnailMock = vi.fn();
vi.mock('../utils/thumbnail', () => ({
  captureThumbnailAtPreset: (...args: unknown[]) => captureThumbnailMock(...args),
}));

import { useImportedDesignAutoSave } from './useImportedDesignAutoSave';

const envelope = { width: 2, depth: 1, gridUnitMm: 42, heightUnitMm: 7 } as ItemEnvelope;
const structure: ImportedMeshStructure = {
  kind: 'importedMesh',
  heightUnits: 3,
  asset: {
    name: 'widget',
    data: 'AAAA',
    triangleCount: 4,
    sizeMm: { x: 83.5, y: 41.5, z: 21 },
    outlines: [],
  },
};

const savedRecord = {
  id: designId('d1'),
  name: 'widget',
  kind: 'importedMesh',
  envelope,
  structure,
  thumbnail: 'data:image/png;base64,existing',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  exportFileNameConfig: null,
} as SavedDesign;

function setStoreState(overrides: Record<string, unknown> = {}): void {
  useDesignerStore.setState({
    itemKind: 'importedMesh',
    envelope,
    structure: { ...structure },
    currentDesignId: 'd1',
    generation: { ...useDesignerStore.getState().generation, status: 'idle' },
    ...overrides,
  } as never);
}

describe('useImportedDesignAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loadDesignMock.mockResolvedValue(ok(savedRecord));
    saveDesignMock.mockResolvedValue(ok(savedRecord));
    updateDesignThumbnailMock.mockResolvedValue(ok(savedRecord));
    captureThumbnailMock.mockReturnValue('data:image/png;base64,captured');
    setStoreState();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('does not save on mount or on design switch', async () => {
    const { rerender } = renderHook(() => useImportedDesignAutoSave());
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(saveDesignMock).not.toHaveBeenCalled();

    // Switching designs resets tracking without saving.
    act(() => setStoreState({ currentDesignId: 'd2' }));
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(saveDesignMock).not.toHaveBeenCalled();
  });

  it('debounce-saves a footprint edit, merging over the loaded record', async () => {
    const { rerender } = renderHook(() => useImportedDesignAutoSave());
    act(() => setStoreState({ structure: { ...structure, heightUnits: 4 } }));
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(1500));

    expect(loadDesignMock).toHaveBeenCalledWith('d1');
    // Merge preserves the stored thumbnail/createdAt (spread of the loaded record).
    expect(saveDesignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'importedMesh',
        thumbnail: 'data:image/png;base64,existing',
        structure: expect.objectContaining({ heightUnits: 4 }),
      })
    );
    expect(upsertRegistryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', kind: 'importedMesh' })
    );
  });

  it('captures the thumbnail once after the first completed generation', async () => {
    const { rerender } = renderHook(() => useImportedDesignAutoSave());
    act(() =>
      setStoreState({
        generation: { ...useDesignerStore.getState().generation, status: 'complete' },
      })
    );
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(captureThumbnailMock).toHaveBeenCalledTimes(1);
    expect(updateDesignThumbnailMock).toHaveBeenCalledWith('d1', 'data:image/png;base64,captured');

    // A later re-completion for the same design does not re-capture.
    act(() =>
      setStoreState({
        generation: { ...useDesignerStore.getState().generation, status: 'complete' },
      })
    );
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(captureThumbnailMock).toHaveBeenCalledTimes(1);
  });

  it('is inert for bin designs', async () => {
    act(() => setStoreState({ itemKind: 'bin' }));
    renderHook(() => useImportedDesignAutoSave());
    act(() => setStoreState({ itemKind: 'bin', envelope: { ...envelope, width: 3 } }));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(saveDesignMock).not.toHaveBeenCalled();
  });
});
