import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStagingDragInteraction } from '@/hooks/interactions/useStagingDragInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHistoryStore } from '@/core/store/history';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import { isOk } from '@/core/result';
import type { InteractionContext } from '@/hooks/interactions/types';

// Mock ML tracking to avoid side effects
vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackPlacement: vi.fn(),
    trackLayerMove: vi.fn(),
    trackDeletion: vi.fn(),
  },
}));

// Helper type for addBin result
type AddBinResult = ReturnType<ReturnType<typeof useLayoutStore.getState>['addBin']>;

// Helper to extract bin ID from Result
function getBinId(result: AddBinResult): string {
  if (!isOk(result)) throw new Error('addBin failed');
  return result.value;
}

describe('useStagingDragInteraction', () => {
  const mockSetInteraction = vi.fn();
  const mockSetDropTarget = vi.fn();
  const mockSetSelectedBin = vi.fn();
  const mockUpdateBin = vi.fn();
  const mockDeleteBin = vi.fn();
  const mockExecute = vi.fn((fn: () => void) => fn());
  const mockActivePointerIdRef = { current: null };
  const mockCapturedPointerRef = { current: null };

  const createContext = (): InteractionContext => {
    const { layout } = useLayoutStore.getState();
    const { activeLayerId } = useSelectionStore.getState();

    return {
      layout,
      activeLayerId,
      setInteraction: mockSetInteraction,
      setDropTarget: mockSetDropTarget,
      setSelectedBin: mockSetSelectedBin,
      updateBin: mockUpdateBin,
      deleteBin: mockDeleteBin,
      addBin: vi.fn(),
      execute: mockExecute,
      activePointerIdRef: mockActivePointerIdRef,
      capturedPointerRef: mockCapturedPointerRef,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all stores
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useSelectionStore.setState({
      activeLayerId: defaultLayout.layers[0].id,
      selectedBinIds: [],
      activeCategoryId: defaultLayout.categories[0].id,
      focusedBinId: null,
      quickLabelBinId: null,
    });
    useInteractionStore.setState({
      interaction: null,
      dropTarget: null,
      paintSize: null,
      showIsometricPreview: true,
      isometricRotation: 0,
      isPreviewExpanded: false,
      layerViewMode: 'stack',
      keyboardDragMode: false,
      keyboardResizeMode: false,
      liveMessage: null,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  // Helper to add a bin in staging
  function addStagingBin(): string {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;

    return getBinId(addBin({
      layerId: STAGING_ID, // Staging area
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
      category: categoryId,
      label: 'Test bin',
      notes: '',
    }));
  }

  // Helper to add a bin on the grid
  function addGridBin(x: number, y: number): string {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    return getBinId(addBin({
      layerId,
      x,
      y,
      width: 2,
      depth: 2,
      height: 3,
      category: categoryId,
      label: '',
      notes: '',
    }));
  }

  describe('start()', () => {
    it('sets up staging drag interaction state', () => {
      const binId = addStagingBin();
      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.start(binId);
      });

      expect(mockSetInteraction).toHaveBeenCalledWith({
        type: 'stagingDrag',
        binId,
        currentCoord: null,
        valid: false,
      });
    });

    it('does nothing if bin not found', () => {
      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.start('non-existent-bin-id');
      });

      expect(mockSetInteraction).not.toHaveBeenCalled();
    });

    it('handles pointer ID for capture', () => {
      const binId = addStagingBin();
      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.start(binId, 123);
      });

      // Pointer ID should be stored for capture
      expect(mockActivePointerIdRef.current).toBe(123);
    });
  });

  describe('handleMove()', () => {
    it('updates position during drag', () => {
      const binId = addStagingBin();

      // Set up interaction state
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: null,
          valid: false,
        },
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleMove({ x: 3, y: 4 }, { x: 3, y: 4 });
      });

      expect(mockSetInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stagingDrag',
          currentCoord: { x: 3, y: 4 },
        })
      );
    });

    it('clamps position to grid bounds', () => {
      const binId = addStagingBin();
      const layout = useLayoutStore.getState().layout;

      // Set up interaction state
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: null,
          valid: false,
        },
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      // Try to move beyond bounds (drawer is 10x8, bin is 2x2)
      act(() => {
        result.current.handleMove({ x: 20, y: 20 }, { x: 20, y: 20 });
      });

      // Should be clamped to max position (8, 6 for a 2x2 bin in 10x8 drawer)
      expect(mockSetInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          currentCoord: {
            x: layout.drawer.width - 2, // 10 - 2 = 8
            y: layout.drawer.depth - 2, // 8 - 2 = 6
          },
        })
      );
    });

    it('validates placement', () => {
      const binId = addStagingBin();

      // Set up interaction state
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: null,
          valid: false,
        },
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      // Move to valid empty spot
      act(() => {
        result.current.handleMove({ x: 2, y: 2 }, { x: 2, y: 2 });
      });

      expect(mockSetInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
        })
      );
    });

    it('marks placement as invalid if collision detected', () => {
      const binId = addStagingBin();
      // Add a bin on the grid that will collide
      addGridBin(2, 2);

      // Set up interaction state
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: null,
          valid: false,
        },
      });

      // Need fresh context with updated layout
      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      // Try to move to occupied spot (2,2 has a 2x2 bin)
      act(() => {
        result.current.handleMove({ x: 2, y: 2 }, { x: 2, y: 2 });
      });

      expect(mockSetInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: false,
        })
      );
    });

    it('exits early if no interaction state', () => {
      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleMove({ x: 2, y: 2 }, { x: 2, y: 2 });
      });

      expect(mockSetInteraction).not.toHaveBeenCalled();
    });

    it('exits early if wrong interaction type', () => {
      // Set up draw interaction instead of stagingDrag
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'draw',
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleMove({ x: 2, y: 2 }, { x: 2, y: 2 });
      });

      expect(mockSetInteraction).not.toHaveBeenCalled();
    });

    it('exits early if bin not found', () => {
      // Set up interaction with non-existent bin
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId: 'non-existent',
          currentCoord: null,
          valid: false,
        },
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleMove({ x: 2, y: 2 }, { x: 2, y: 2 });
      });

      expect(mockSetInteraction).not.toHaveBeenCalled();
    });
  });

  describe('handleUp()', () => {
    it('deletes bin when dropped on trash', () => {
      const binId = addStagingBin();

      // Set up interaction and drop target
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: { x: 2, y: 2 },
          valid: true,
        },
        dropTarget: 'trash',
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockDeleteBin).toHaveBeenCalledWith(binId);
      expect(mockSetDropTarget).toHaveBeenCalledWith(null);
      expect(mockSetInteraction).toHaveBeenCalledWith(null);
    });

    it('places bin on grid if valid position', () => {
      const binId = addStagingBin();

      // Set up valid interaction
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: { x: 3, y: 4 },
          valid: true,
        },
        dropTarget: null,
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockUpdateBin).toHaveBeenCalledWith(binId, {
        x: 3,
        y: 4,
        layerId: context.activeLayerId,
      });
      expect(mockSetSelectedBin).toHaveBeenCalledWith(binId);
    });

    it('does nothing if position is invalid', () => {
      const binId = addStagingBin();

      // Set up invalid interaction
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: { x: 2, y: 2 },
          valid: false, // Invalid placement
        },
        dropTarget: null,
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockDeleteBin).not.toHaveBeenCalled();
    });

    it('does nothing if no current coord', () => {
      const binId = addStagingBin();

      // Set up interaction without currentCoord
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: null,
          valid: true, // Valid but no coord
        },
        dropTarget: null,
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });

    it('exits early if no interaction state', () => {
      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockDeleteBin).not.toHaveBeenCalled();
    });

    it('exits early if wrong interaction type', () => {
      // Set up draw interaction instead
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'draw',
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });

    it('does nothing if bin not found during placement', () => {
      // Set up interaction with valid coord but bin deleted
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId: 'deleted-bin-id',
          currentCoord: { x: 2, y: 2 },
          valid: true,
        },
        dropTarget: null,
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });

    it('executes undoable action for placement', () => {
      const binId = addStagingBin();

      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: { x: 2, y: 2 },
          valid: true,
        },
        dropTarget: null,
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      // execute should have been called to wrap the action
      expect(mockExecute).toHaveBeenCalled();
    });

    it('executes undoable action for trash deletion', () => {
      const binId = addStagingBin();

      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: { x: 2, y: 2 },
          valid: true,
        },
        dropTarget: 'trash',
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('ML tracking', () => {
    it('tracks placement when bin is placed on grid', async () => {
      const { mlTracking } = await import('@/shared/analytics/useMLTracking');
      const binId = addStagingBin();

      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'stagingDrag',
          binId,
          currentCoord: { x: 3, y: 4 },
          valid: true,
        },
        dropTarget: null,
      });

      const context = createContext();
      const { result } = renderHook(() => useStagingDragInteraction(context));

      act(() => {
        result.current.handleUp();
      });

      expect(mlTracking.trackPlacement).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 4 }),
        'staging'
      );
      expect(mlTracking.trackLayerMove).toHaveBeenCalled();
    });
  });
});
