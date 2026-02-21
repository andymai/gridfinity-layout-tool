import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStagingDragInteraction } from '@/hooks/interactions/useStagingDragInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { STAGING_ID } from '@/core/constants';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { resetAllStores, getBinId } from '@/test/testUtils';
import type { InteractionContext } from '@/hooks/interactions/types';

// Mock ML tracking to avoid side effects
vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackPlacement: vi.fn(),
    trackLayerMove: vi.fn(),
    trackDeletion: vi.fn(),
  },
}));

describe('useStagingDragInteraction', () => {
  const mockSetInteraction = vi.fn();
  const mockSetDropTarget = vi.fn();
  const mockSetSelectedBin = vi.fn();
  const mockUpdateBin = vi.fn();
  const mockDeleteBin = vi.fn();
  const mockExecute = vi.fn((fn: () => void) => fn());
  const mockActivePointerIdRef = { current: null };
  const mockCapturedPointerRef = { current: null };
  const mockCtrlKeyRef = { current: false };

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
      ctrlKeyRef: mockCtrlKeyRef,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    const { layout } = useLayoutStore.getState();
    useSelectionStore.setState({
      activeLayerId: layout.layers[0].id,
      activeCategoryId: layout.categories[0].id,
    });
  });

  // Helper to add a bin in staging
  function addStagingBin(): string {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;

    return getBinId(
      addBin({
        layerId: STAGING_ID, // Staging area
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Test bin',
        notes: '',
      })
    );
  }

  // Helper to add a bin on the grid
  function addGridBin(x: number, y: number): string {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    return getBinId(
      addBin({
        layerId,
        x,
        y,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );
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

    it('snaps to nearest valid position on collision at bin boundary', () => {
      const binId = addStagingBin(); // 2x2 bin
      // Add a bin on the grid at (4,2) with width=2, depth=2
      addGridBin(4, 2);

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

      // Cursor at x=3: 2-wide staging bin would span [3,5), overlapping grid bin at [4,6).
      // Should snap 1 cell left to x=2 where [2,4) doesn't overlap [4,6).
      act(() => {
        result.current.handleMove({ x: 3, y: 2 }, { x: 3, y: 2 });
      });

      const call = mockSetInteraction.mock.calls[0][0];
      expect(call.valid).toBe(true);
      expect(call.currentCoord).toEqual({ x: 2, y: 2 });
    });

    it('snaps to valid position when directly on top of another bin (within radius 2)', () => {
      const binId = addStagingBin(); // 2x2 bin
      // Add a bin at (2,2) — same position
      addGridBin(2, 2);

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

      // With SNAP_RADIUS=2, the 2x2 bin can snap 2 steps away (e.g., to (4,2) or (0,0))
      // where it no longer overlaps the grid bin at [2,4)×[2,4)
      act(() => {
        result.current.handleMove({ x: 2, y: 2 }, { x: 2, y: 2 });
      });

      const call = mockSetInteraction.mock.calls[0][0];
      expect(call.valid).toBe(true);
      expect(call.isSnapped).toBe(true);
    });

    it('marks invalid when no nearby valid position exists', () => {
      const binId = addStagingBin(); // 2x2 bin

      // Fill the grid densely so there's no room to snap to
      // Default drawer is 10x8, fill it with 2x2 bins
      for (let x = 0; x < 10; x += 2) {
        for (let y = 0; y < 8; y += 2) {
          addGridBin(x, y);
        }
      }

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
        result.current.handleMove({ x: 4, y: 4 }, { x: 4, y: 4 });
      });

      expect(mockSetInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: false,
          invalidReason: 'collision',
        })
      );
    });

    it('snaps with 0.5 step in half-bin mode', () => {
      const binId = addStagingBin(); // 2x2 bin
      addGridBin(4, 2); // grid bin at (4,2)

      // Enable half-bin mode
      useHalfBinModeStore.setState({ halfBinMode: true });

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

      // Cursor at x=2.5: bin [2.5,4.5) overlaps grid [4,6).
      // Half-bin step=0.5 → nudge left to x=2.0: bin [2,4) no overlap.
      act(() => {
        result.current.handleMove({ x: 2.5, y: 2 }, { x: 2.5, y: 2 });
      });

      const call = mockSetInteraction.mock.calls[0][0];
      expect(call.valid).toBe(true);
      expect(call.currentCoord).toEqual({ x: 2, y: 2 });

      // Clean up
      useHalfBinModeStore.setState({ halfBinMode: false });
    });

    it('snaps when blocked_zone detected', () => {
      // Create a tall bin on layer 0 that protrudes into layer 1
      const { addBin, layout, addLayer } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;
      const layer0Id = layout.layers[0].id;

      // Add a second layer
      addLayer();
      const updatedLayout = useLayoutStore.getState().layout;
      const layer1Id = updatedLayout.layers[1].id;

      // Tall bin on layer 0 that protrudes into layer 1
      addBin({
        layerId: layer0Id,
        x: 4,
        y: 2,
        width: 2,
        depth: 2,
        height: updatedLayout.layers[0].height + 1, // protrudes
        category: categoryId,
        label: '',
        notes: '',
      });

      // Add staging bin and set active layer to layer 1
      const binId = addStagingBin();
      useSelectionStore.setState({ activeLayerId: layer1Id });

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

      // Try placing at (3,2) — overlaps blocked zone from tall bin at (4,2).
      // Should snap to (2,2) or another valid position.
      act(() => {
        result.current.handleMove({ x: 3, y: 2 }, { x: 3, y: 2 });
      });

      const call = mockSetInteraction.mock.calls[0][0];
      expect(call.valid).toBe(true);
      expect(call.currentCoord.x).not.toBe(3);
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
