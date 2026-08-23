import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ok } from '@/core/result';
import type * as DesignerStorageModule from '../storage/DesignerStorage';
import { designId } from '@/core/types';

const saveDesignMock = vi.fn();
const loadDesignMock = vi.fn();

vi.mock('@/features/bin-designer/storage/DesignerStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof DesignerStorageModule>();
  return {
    ...actual,
    saveDesign: (input: unknown) => saveDesignMock(input),
    loadDesign: (id: string) => loadDesignMock(id),
  };
});

vi.mock('../utils/thumbnail', () => ({
  captureThumbnailAtPreset: () => null,
}));

import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useWorkshopAutoSave } from './useWorkshopAutoSave';

const savedRow = (id: string): Record<string, unknown> => ({
  id: designId(id),
  name: 'Untitled',
  kind: 'assembly',
  thumbnail: null,
  exportFileNameConfig: null,
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z',
});

describe('useWorkshopAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
  });

  it('creates the design on the first part placed and adopts the id', async () => {
    saveDesignMock.mockResolvedValueOnce(ok(savedRow('design_1_abcdef')));
    const { unmount } = renderHook(() => useWorkshopAutoSave());
    act(() => {
      useDesignerStore.getState().addAssemblyPart('post', null);
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
    });
    expect(saveDesignMock).toHaveBeenCalledTimes(1);
    const created = saveDesignMock.mock.calls[0]?.[0] as { kind?: string; structure?: unknown };
    expect(created.kind).toBe('assembly');
    expect(useDesignerStore.getState().currentDesignId).toBe('design_1_abcdef');
    unmount();
    vi.useRealTimers();
  });

  it('persists a structure edit debounced, merging over the loaded record', async () => {
    saveDesignMock.mockResolvedValue(ok(savedRow('design_1_abcdef')));
    loadDesignMock.mockResolvedValue(ok(savedRow('design_1_abcdef')));
    const { unmount } = renderHook(() => useWorkshopAutoSave());
    act(() => {
      useDesignerStore.getState().addAssemblyPart('post', null);
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
      await Promise.resolve();
    });
    const id = useDesignerStore.getState().ui.selectedAssemblyPartId;
    act(() => {
      if (id) useDesignerStore.getState().moveAssemblyPart(id, { x: 30 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadDesignMock).toHaveBeenCalled();
    expect(saveDesignMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
    vi.useRealTimers();
  });

  it('does nothing for bins or empty builds', async () => {
    const { unmount } = renderHook(() => useWorkshopAutoSave());
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(saveDesignMock).not.toHaveBeenCalled();
    unmount();
    vi.useRealTimers();
  });
});
