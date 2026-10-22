import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import { _resetDesignSaveGate, settleDesignSaves } from './designSaveGate';
import { useDesignerStore } from '../store/designer';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import { ok, err, storageNotFound, storageUnavailable } from '@/core/result';
import { onSyncEvent } from '@/shared/events/syncEventBus';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '../constants/defaults';
import { loadRegistry } from '../store/customBinRegistry';
import type { SavedDesign } from '../types';
import { designId } from '@/core/types';
import type { Result, StorageError } from '@/core/result';

vi.mock('@/features/bin-designer/storage/DesignerStorage');
vi.mock('../../utils/thumbnail', () => ({
  captureThumbnailAtPreset: () => null,
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(DesignerStorage.updateDesignParams).mockReset();
    _resetDesignSaveGate();

    // Reset store to clean state with generation complete (so thumbnail capture proceeds)
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockUpdateDesignParams(id: string = 'existing-id') {
    const savedDesign: SavedDesign = {
      id: designId(id),
      name: 'Existing Bin',
      params: { ...DEFAULT_BIN_PARAMS, width: 3 },
      thumbnail: null,
      exportFileNameConfig: null,
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
      expect.objectContaining({ style: 'descriptive', customName: '' })
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
      expect.objectContaining({ style: 'descriptive', customName: '' })
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
    let resolvePromise: ((value: Result<SavedDesign, StorageError>) => void) | null = null;
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
          id: designId('existing-id'),
          name: 'Test',
          params: { ...DEFAULT_BIN_PARAMS, width: 3 },
          thumbnail: null,
          exportFileNameConfig: null,
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
      expect.objectContaining({ style: 'descriptive', customName: '' })
    );
  });

  // `idle` is the pre-generation state — saving immediately on idle captured a
  // thumbnail of an empty canvas when an effect fired before the param change
  // had kicked off generation.
  it('waits for generation to complete before saving when status starts at idle', async () => {
    mockUpdateDesignParams();
    useDesignerStore.setState({
      currentDesignId: 'existing-id',
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });

    renderHook(() => useAutoSave());

    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    // Debounce elapses; waitForGenerationComplete starts polling.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Worker hasn't reported back yet — save must not have fired.
    expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();

    // Now generation finishes; save should proceed within the next poll + render delay.
    act(() => {
      useDesignerStore.setState({
        generation: {
          ...DEFAULT_GENERATION_STATE,
          status: 'complete',
          mesh: null,
          progress: 1,
          epoch: 1,
        },
      });
    });
    await advanceThroughSave();

    expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
  });

  // Leaving the designer unmounts the hook. Both the debounce and the
  // generation wait used to be aborted, so the last edits never reached
  // IndexedDB while the in-memory store kept showing them.
  describe('flush on unmount', () => {
    it('persists a pending edit when unmounted inside the debounce window', async () => {
      mockUpdateDesignParams();
      useDesignerStore.setState({ currentDesignId: 'existing-id' });

      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 4);
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        unmount();
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
        'existing-id',
        expect.objectContaining({ width: 4 }),
        undefined, // thumbnail untouched — the canvas is already gone
        expect.objectContaining({ style: 'descriptive', customName: '' })
      );
    });

    it('persists an edit whose save was still waiting on generation', async () => {
      mockUpdateDesignParams();
      useDesignerStore.setState({
        currentDesignId: 'existing-id',
        generation: {
          ...DEFAULT_GENERATION_STATE,
          status: 'generating',
          mesh: null,
          progress: 0,
          epoch: 0,
        },
      });

      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 6);
      });

      // Debounce elapses; the save is parked in waitForGenerationComplete.
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });
      expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();

      await act(async () => {
        unmount();
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
        'existing-id',
        expect.objectContaining({ width: 6 }),
        undefined,
        expect.anything()
      );
    });

    it('updates the registry and notifies linked bins when flushing', async () => {
      mockUpdateDesignParams();
      useDesignerStore.setState({ currentDesignId: 'existing-id' });
      const onDesignSaved = vi.fn();
      const unsubscribe = onSyncEvent('design-saved', onDesignSaved);

      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 4);
      });

      await act(async () => {
        unmount();
      });

      expect(loadRegistry()).toContainEqual(expect.objectContaining({ id: 'existing-id' }));
      expect(onDesignSaved).toHaveBeenCalledWith(
        expect.objectContaining({ designId: 'existing-id' })
      );
      unsubscribe();
    });

    // The writer half of the registry's overhang field: a design edited in the
    // designer has to carry its overhang into the registry, or the layout side
    // reads "no overhang" for a bin that is far too wide to print.
    it('records the design overhang on the registry entry', async () => {
      mockUpdateDesignParams();
      useDesignerStore.setState({ currentDesignId: 'existing-id' });

      const { unmount } = renderHook(() => useAutoSave());
      act(() => {
        useDesignerStore
          .getState()
          .setParam('overhang', { left: 61.5, right: 42, front: 0, back: 0, enabled: true });
      });
      await act(async () => {
        unmount();
      });

      expect(loadRegistry()).toContainEqual(
        expect.objectContaining({
          id: 'existing-id',
          overhangMm: { left: 61.5, right: 42, front: 0, back: 0 },
        })
      );
    });

    it('clears a recorded overhang once the design no longer has one', async () => {
      mockUpdateDesignParams();
      useDesignerStore.setState({ currentDesignId: 'existing-id' });

      const first = renderHook(() => useAutoSave());
      act(() => {
        useDesignerStore
          .getState()
          .setParam('overhang', { left: 61.5, right: 0, front: 0, back: 0, enabled: true });
      });
      await act(async () => {
        first.unmount();
      });

      const second = renderHook(() => useAutoSave());
      act(() => {
        useDesignerStore
          .getState()
          .setParam('overhang', { left: 0, right: 0, front: 0, back: 0, enabled: false });
      });
      await act(async () => {
        second.unmount();
      });

      expect(loadRegistry()[0]?.overhangMm).toBeUndefined();
    });

    it('does not duplicate a write for the save already in flight', async () => {
      let resolveWrite: ((value: Result<SavedDesign, StorageError>) => void) | null = null;
      vi.mocked(DesignerStorage.updateDesignParams).mockReturnValue(
        new Promise((resolve) => {
          resolveWrite = resolve;
        })
      );
      useDesignerStore.setState({ currentDesignId: 'existing-id' });

      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 4);
      });

      // Let the save reach updateDesignParams, where it now blocks.
      await advanceThroughSave();
      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();

      await act(async () => {
        unmount();
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
      expect(resolveWrite).not.toBeNull();
    });

    // The in-flight save carries older params, so the newer edit still needs
    // flushing rather than being swallowed by the dedupe above.
    it('still flushes when the in-flight save is for older params', async () => {
      let resolveWrite: ((value: Result<SavedDesign, StorageError>) => void) | null = null;
      vi.mocked(DesignerStorage.updateDesignParams).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveWrite = resolve;
        })
      );
      useDesignerStore.setState({ currentDesignId: 'existing-id' });

      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 4);
      });
      await advanceThroughSave();
      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();

      mockUpdateDesignParams();
      act(() => {
        useDesignerStore.getState().setParam('width', 9);
      });

      await act(async () => {
        unmount();
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledTimes(2);
      expect(DesignerStorage.updateDesignParams).toHaveBeenLastCalledWith(
        'existing-id',
        expect.objectContaining({ width: 9 }),
        undefined,
        expect.anything()
      );
      expect(resolveWrite).not.toBeNull();
    });

    it('does not write when nothing changed since the last save', async () => {
      mockUpdateDesignParams();
      useDesignerStore.setState({ currentDesignId: 'existing-id' });

      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 4);
      });
      await advanceThroughSave();
      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();

      await act(async () => {
        unmount();
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
    });

    describe('on switching to another design', () => {
      const otherDesign: SavedDesign = {
        id: designId('other-id'),
        name: 'Other Bin',
        params: { ...DEFAULT_BIN_PARAMS, width: 2 },
        thumbnail: null,
        exportFileNameConfig: null,
        createdAt: '2026-01-22T00:00:00.000Z',
        updatedAt: '2026-01-22T00:01:00.000Z',
      };

      it('persists the edit still inside the debounce window to the design it was made on', async () => {
        mockUpdateDesignParams();
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());

        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          vi.advanceTimersByTime(300);
          useDesignerStore.getState().loadDesign(otherDesign);
        });
        await advanceThroughSave();

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
          'existing-id',
          expect.objectContaining({ width: 4 }),
          undefined,
          expect.anything()
        );
      });

      it('persists an edit whose save was still waiting on generation', async () => {
        mockUpdateDesignParams();
        useDesignerStore.setState({
          currentDesignId: 'existing-id',
          generation: {
            ...DEFAULT_GENERATION_STATE,
            status: 'generating',
            mesh: null,
            progress: 0,
            epoch: 0,
          },
        });
        renderHook(() => useAutoSave());

        act(() => {
          useDesignerStore.getState().setParam('width', 6);
        });
        await act(async () => {
          vi.advanceTimersByTime(1100);
        });
        expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();

        await act(async () => {
          useDesignerStore.getState().loadDesign(otherDesign);
        });

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
          'existing-id',
          expect.objectContaining({ width: 6 }),
          undefined,
          expect.anything()
        );
      });

      it('leaves the design switched to as the active one, with nothing to flush', async () => {
        mockUpdateDesignParams();
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        const { unmount } = renderHook(() => useAutoSave());

        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          useDesignerStore.getState().loadDesign(otherDesign);
        });
        await advanceThroughSave();
        await act(async () => {
          unmount();
        });

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
        expect(DesignerStorage.setActiveDesignId).not.toHaveBeenCalledWith('existing-id');
      });

      // A → B → A where the return read storage before A's flush landed: the
      // late write must not mark the stale copy now in the editor as saved.
      it('does not let a late write vouch for a copy of the design reopened before it landed', async () => {
        const savedDesign = mockUpdateDesignParams();
        let land = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              land = () => resolve(ok(savedDesign));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        const { unmount } = renderHook(() => useAutoSave());

        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          useDesignerStore.getState().loadDesign(otherDesign);
        });
        await act(async () => {
          useDesignerStore.getState().loadDesign({
            ...otherDesign,
            id: designId('existing-id'),
            params: { ...DEFAULT_BIN_PARAMS, width: 2 },
          });
        });
        await act(async () => {
          land();
        });
        await act(async () => {
          unmount();
        });

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
          'existing-id',
          expect.objectContaining({ width: 4 }),
          undefined,
          expect.anything()
        );
      });

      it('does not write when the design had no unsaved edit', async () => {
        mockUpdateDesignParams();
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());

        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await advanceThroughSave();
        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();

        await act(async () => {
          useDesignerStore.getState().loadDesign(otherDesign);
        });
        await advanceThroughSave();

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
      });
    });

    describe('settleDesignSaves', () => {
      it('writes the open edit and resolves only once it has landed', async () => {
        const savedDesign = mockUpdateDesignParams();
        let land = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              land = () => resolve(ok(savedDesign));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });

        let settled = false;
        await act(async () => {
          void settleDesignSaves().then(() => {
            settled = true;
          });
        });
        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
          'existing-id',
          expect.objectContaining({ width: 4 }),
          undefined,
          expect.anything()
        );
        expect(settled).toBe(false);

        await act(async () => {
          land();
        });
        expect(settled).toBe(true);
      });

      it('writes an edit made while the first write was landing before resolving', async () => {
        const savedDesign = mockUpdateDesignParams();
        let land = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              land = () => resolve(ok(savedDesign));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });

        let settled: boolean | null = null;
        await act(async () => {
          void settleDesignSaves().then((saved) => {
            settled = saved;
          });
        });
        act(() => {
          useDesignerStore.getState().setParam('width', 5);
        });
        await act(async () => {
          land();
        });

        expect(settled).toBe(true);
        expect(DesignerStorage.updateDesignParams).toHaveBeenLastCalledWith(
          'existing-id',
          expect.objectContaining({ width: 5 }),
          undefined,
          expect.anything()
        );
      });

      it('reports unsaved when a new edit lands in every round it is given', async () => {
        const savedDesign = mockUpdateDesignParams();
        let width = 4;
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementation(() => {
          width += 1;
          useDesignerStore.getState().setParam('width', width);
          return Promise.resolve(ok(savedDesign));
        });
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', width);
        });

        let settled: boolean | null = null;
        await act(async () => {
          settled = await settleDesignSaves();
        });

        expect(settled).toBe(false);
      });

      it("still reports a switched-away design's failed write after the open one saves", async () => {
        mockUpdateDesignParams();
        let fail = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              fail = () => resolve(err(storageUnavailable('indexedDB')));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          useDesignerStore.getState().loadDesign({
            id: designId('other-id'),
            name: 'Other Bin',
            params: { ...DEFAULT_BIN_PARAMS, width: 2 },
            thumbnail: null,
            exportFileNameConfig: null,
            createdAt: '2026-01-22T00:00:00.000Z',
            updatedAt: '2026-01-22T00:01:00.000Z',
          });
        });
        // The open design's edit arrives while the first round still waits on
        // the failing write, so it is saved in a later round.
        let settled: boolean | null = null;
        await act(async () => {
          void settleDesignSaves().then((saved) => {
            settled = saved;
          });
        });
        act(() => {
          useDesignerStore.getState().setParam('width', 3);
        });
        await act(async () => {
          fail();
        });

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
          'other-id',
          expect.objectContaining({ width: 3 }),
          undefined,
          expect.anything()
        );
        expect(settled).toBe(false);
      });

      it('still waits for the write the designer flushed as it closed', async () => {
        const savedDesign = mockUpdateDesignParams();
        let land = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              land = () => resolve(ok(savedDesign));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        const { unmount } = renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          unmount();
        });

        let settled: boolean | null = null;
        await act(async () => {
          void settleDesignSaves().then((saved) => {
            settled = saved;
          });
        });
        expect(settled).toBeNull();

        await act(async () => {
          land();
        });
        expect(settled).toBe(true);
      });

      it('retries an edit whose flush failed as the designer closed', async () => {
        mockUpdateDesignParams();
        vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValueOnce(
          err(storageUnavailable('indexedDB'))
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        const first = renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          first.unmount();
        });

        renderHook(() => useAutoSave());
        let settled: boolean | null = null;
        await act(async () => {
          settled = await settleDesignSaves();
        });

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledTimes(2);
        expect(DesignerStorage.updateDesignParams).toHaveBeenLastCalledWith(
          'existing-id',
          expect.objectContaining({ width: 4 }),
          undefined,
          expect.anything()
        );
        expect(settled).toBe(true);
      });

      it('does not let a flush that lands after closing pick the active design', async () => {
        const savedDesign = mockUpdateDesignParams();
        let land = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              land = () => resolve(ok(savedDesign));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        const { unmount } = renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          unmount();
        });
        await act(async () => {
          land();
        });

        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
        expect(DesignerStorage.setActiveDesignId).not.toHaveBeenCalled();
      });

      it('does not hold a switch for a design deleted while it was open', async () => {
        vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
          err(storageNotFound('existing-id'))
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });

        let settled: boolean | null = null;
        await act(async () => {
          settled = await settleDesignSaves();
        });

        expect(settled).toBe(true);
      });

      it('reports a write that failed', async () => {
        vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
          err(storageUnavailable('indexedDB'))
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });

        let settled: boolean | null = null;
        await act(async () => {
          settled = await settleDesignSaves();
        });

        expect(settled).toBe(false);
      });

      it("waits for a switched-away design's write that is still landing", async () => {
        const savedDesign = mockUpdateDesignParams();
        let land = (): void => {};
        vi.mocked(DesignerStorage.updateDesignParams).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              land = () => resolve(ok(savedDesign));
            })
        );
        useDesignerStore.setState({ currentDesignId: 'existing-id' });
        renderHook(() => useAutoSave());
        act(() => {
          useDesignerStore.getState().setParam('width', 4);
        });
        await act(async () => {
          useDesignerStore.getState().loadDesign({
            id: designId('other-id'),
            name: 'Other Bin',
            params: { ...DEFAULT_BIN_PARAMS, width: 2 },
            thumbnail: null,
            exportFileNameConfig: null,
            createdAt: '2026-01-22T00:00:00.000Z',
            updatedAt: '2026-01-22T00:01:00.000Z',
          });
        });

        let settled = false;
        await act(async () => {
          void settleDesignSaves().then(() => {
            settled = true;
          });
        });
        expect(settled).toBe(false);

        await act(async () => {
          land();
        });
        expect(settled).toBe(true);
        expect(DesignerStorage.updateDesignParams).toHaveBeenCalledOnce();
      });
    });

    it('does not write for an unsaved design', async () => {
      mockUpdateDesignParams();
      const { unmount } = renderHook(() => useAutoSave());

      act(() => {
        useDesignerStore.getState().setParam('width', 4);
      });

      await act(async () => {
        unmount();
      });

      expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();
    });
  });
});
