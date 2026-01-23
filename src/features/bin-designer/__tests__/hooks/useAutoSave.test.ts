import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDesignerStore } from '../../store/designer';
import * as DesignerStorage from '@/core/storage/DesignerStorage';
import { ok, err, storageUnavailable } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';
import type { SavedDesign } from '../../types';

vi.mock('@/core/storage/DesignerStorage');
vi.mock('../../utils/thumbnail', () => ({
  captureThumbnail: () => null,
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset store to clean state
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockSaveDesign(id: string = 'new-id-123') {
    const savedDesign: SavedDesign = {
      id,
      name: 'Untitled Bin',
      params: DEFAULT_BIN_PARAMS,
      thumbnail: null,
      createdAt: '2026-01-22T00:00:00.000Z',
      updatedAt: '2026-01-22T00:00:00.000Z',
    };
    vi.mocked(DesignerStorage.saveDesign).mockResolvedValue(ok(savedDesign));
    return savedDesign;
  }

  function mockUpdateDesignParams() {
    const savedDesign: SavedDesign = {
      id: 'existing-id',
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
    renderHook(() => useAutoSave());

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(DesignerStorage.saveDesign).not.toHaveBeenCalled();
    expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();
  });

  it('should create new design when currentDesignId is null', async () => {
    mockSaveDesign('new-design-id');
    renderHook(() => useAutoSave());

    // Change params to trigger save
    act(() => {
      useDesignerStore.getState().setParam('width', 3);
    });

    // Wait for debounce
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(DesignerStorage.saveDesign).toHaveBeenCalledWith({
      name: 'Untitled Bin',
      params: expect.objectContaining({ width: 3 }),
      thumbnail: null,
    });

    expect(useDesignerStore.getState().currentDesignId).toBe('new-design-id');
    expect(useDesignerStore.getState().saveStatus).toBe('saved');
  });

  it('should update existing design when currentDesignId is set', async () => {
    mockUpdateDesignParams();

    // Set up as existing design
    useDesignerStore.setState({ currentDesignId: 'existing-id' });

    renderHook(() => useAutoSave());

    // Change params
    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
      'existing-id',
      expect.objectContaining({ width: 4 }),
      null // thumbnail (null since no canvas in test)
    );
    expect(useDesignerStore.getState().saveStatus).toBe('saved');
  });

  it('should debounce multiple rapid changes', async () => {
    mockSaveDesign();
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

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Only the last value should be saved
    expect(DesignerStorage.saveDesign).toHaveBeenCalledTimes(1);
    expect(DesignerStorage.saveDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ width: 4 }),
      })
    );
  });

  it('should set saveStatus to error on failure', async () => {
    vi.mocked(DesignerStorage.saveDesign).mockResolvedValue(
      err(storageUnavailable('indexedDB', new Error('quota exceeded')))
    );

    renderHook(() => useAutoSave());

    act(() => {
      useDesignerStore.getState().setParam('width', 5);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(useDesignerStore.getState().saveStatus).toBe('error');
  });

  it('should set saveStatus to saving during save operation', async () => {
    let resolvePromise: ((value: unknown) => void) | null = null;
    vi.mocked(DesignerStorage.saveDesign).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }) as ReturnType<typeof DesignerStorage.saveDesign>
    );

    renderHook(() => useAutoSave());

    act(() => {
      useDesignerStore.getState().setParam('width', 3);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(useDesignerStore.getState().saveStatus).toBe('saving');

    // Resolve the save
    expect(resolvePromise).not.toBeNull();
    await act(async () => {
      resolvePromise?.(ok({
        id: 'test-id',
        name: 'Test',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        createdAt: '2026-01-22T00:00:00.000Z',
        updatedAt: '2026-01-22T00:00:00.000Z',
      }));
    });

    expect(useDesignerStore.getState().saveStatus).toBe('saved');
  });
});
