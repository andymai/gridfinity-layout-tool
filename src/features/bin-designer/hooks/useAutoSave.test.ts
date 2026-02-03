import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import { useDesignerStore } from '../store/designer';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import { ok, err, storageUnavailable } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { SavedDesign } from '../types';

vi.mock('@/features/bin-designer/storage/DesignerStorage');
vi.mock('../../utils/thumbnail', () => ({
  captureThumbnailAtPreset: () => null,
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset store to clean state with generation complete (so thumbnail capture proceeds)
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
      generation: { status: 'complete', mesh: null, progress: 0, epoch: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockUpdateDesignParams(id: string = 'existing-id') {
    const savedDesign: SavedDesign = {
      id,
      name: 'Existing Bin',
      params: { ...DEFAULT_BIN_PARAMS, width: 3 },
      thumbnail: null,
      createdAt: '2026-01-22T00:00:00.000Z',
      updatedAt: '2026-01-22T00:01:00.000Z',
    };
    vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(ok(savedDesign));
    return savedDesign;
  }

  it('should not save on initial render', async () => {
    useDesignerStore.setState({ currentDesignId: 'existing-id' });
    renderHook(() => useAutoSave());

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();
  });

  it('should not save when currentDesignId is null (unsaved design)', async () => {
    renderHook(() => useAutoSave());

    // Change params — should NOT trigger save since design hasn't been explicitly saved
    act(() => {
      useDesignerStore.getState().setParam('width', 3);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();
    expect(useDesignerStore.getState().saveStatus).toBe('idle');
  });

  /** Advance timers through debounce + async generation wait + render delay */
  async function advanceThroughSave() {
    // 1. Trigger debounce timer (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    // 2. Flush microtasks from waitForGenerationComplete + schedule 150ms render delay
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    // 3. Flush remaining microtasks
    await act(async () => {});
  }

  it('should update existing design when currentDesignId is set', async () => {
    mockUpdateDesignParams();

    // Set up as existing design
    useDesignerStore.setState({ currentDesignId: 'existing-id' });

    renderHook(() => useAutoSave());

    // Change params
    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    await advanceThroughSave();

    expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
      'existing-id',
      expect.objectContaining({ width: 4 }),
      null, // thumbnail (null since no canvas in test)
      { style: 'descriptive', customName: '' }
    );
    expect(useDesignerStore.getState().saveStatus).toBe('saved');
  });

  it('should debounce multiple rapid changes', async () => {
    mockUpdateDesignParams();
    useDesignerStore.setState({ currentDesignId: 'existing-id' });

    renderHook(() => useAutoSave());

    // Rapid changes
    act(() => {
      useDesignerStore.getState().setParam('width', 2);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      useDesignerStore.getState().setParam('width', 3);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    await advanceThroughSave();

    // Only the last value should be saved
    expect(DesignerStorage.updateDesignParams).toHaveBeenCalledTimes(1);
    expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
      'existing-id',
      expect.objectContaining({ width: 4 }),
      null,
      { style: 'descriptive', customName: '' }
    );
  });

  it('should set saveStatus to error on failure', async () => {
    vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
      err(storageUnavailable('indexedDB', new Error('quota exceeded')))
    );
    useDesignerStore.setState({ currentDesignId: 'existing-id' });

    renderHook(() => useAutoSave());

    act(() => {
      useDesignerStore.getState().setParam('width', 5);
    });

    await advanceThroughSave();

    expect(useDesignerStore.getState().saveStatus).toBe('error');
  });

  it('should set saveStatus to saving during save operation', async () => {
    let resolvePromise: ((value: unknown) => void) | null = null;
    vi.mocked(DesignerStorage.updateDesignParams).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    useDesignerStore.setState({ currentDesignId: 'existing-id' });

    renderHook(() => useAutoSave());

    act(() => {
      useDesignerStore.getState().setParam('width', 3);
    });

    await advanceThroughSave();

    expect(useDesignerStore.getState().saveStatus).toBe('saving');

    // Resolve the save
    expect(resolvePromise).not.toBeNull();
    await act(async () => {
      resolvePromise?.(
        ok({
          id: 'existing-id',
          name: 'Test',
          params: { ...DEFAULT_BIN_PARAMS, width: 3 },
          thumbnail: null,
          createdAt: '2026-01-22T00:00:00.000Z',
          updatedAt: '2026-01-22T00:00:00.000Z',
        })
      );
    });

    expect(useDesignerStore.getState().saveStatus).toBe('saved');
  });

  it('should start auto-saving after currentDesignId is set', async () => {
    mockUpdateDesignParams();
    renderHook(() => useAutoSave());

    // Initially null — changes are ignored
    act(() => {
      useDesignerStore.getState().setParam('width', 3);
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();

    // Simulate explicit save setting the ID (e.g., user renamed the design)
    act(() => {
      useDesignerStore.setState({ currentDesignId: 'new-id' });
    });

    // Now changes should trigger auto-save
    act(() => {
      useDesignerStore.getState().setParam('width', 5);
    });

    await advanceThroughSave();

    expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
      'new-id',
      expect.objectContaining({ width: 5 }),
      null,
      { style: 'descriptive', customName: '' }
    );
  });
});
