import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawInteraction } from '@/shared/hooks/interactions/useDrawInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfGridModeStore, useToastStore } from '@/core/store';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useGapFitStore } from '@/core/store/gapFit';
import { createTestBin, resetAllStores } from '@/test/testUtils';
import { ok } from '@/core/result';
import { binId, gridUnits, heightUnits } from '@/core/types';
import type { Coord } from '@/core/types';
import type { RefObject } from 'react';
import type {
  InteractionContext,
  PaintSize,
  PointerCaptureHandle,
} from '@/shared/hooks/interactions/types';

const coord = (x: number, y: number): Coord => ({ x: gridUnits(x), y: gridUnits(y) });

// Mock analytics to avoid side effects
vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackPlacement: vi.fn(),
    trackBulk: vi.fn(),
    trackRejection: vi.fn(),
    recordCreation: vi.fn(),
    trackBinCreation: vi.fn(),
    trackBulkCreation: vi.fn(),
  },
}));
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  trackBinCreated: vi.fn(),
  trackPaintMode: vi.fn(),
}));

describe('useDrawInteraction', () => {
  const mockSetInteraction = vi.fn();
  const mockSetSelectedBin = vi.fn();
  const mockSetSelectedBins = vi.fn();
  const mockAddBin = vi.fn();
  const mockExecute = vi.fn((fn: () => void) => fn());
  const mockActivePointerIdRef: RefObject<number | null> = { current: null };
  const mockCapturedPointerRef: RefObject<PointerCaptureHandle | null> = { current: null };
  const mockCtrlKeyRef: RefObject<boolean> = { current: false };
  const mockGridRef: RefObject<HTMLDivElement | null> = { current: null };

  const createContext = (paintSize?: PaintSize): InteractionContext => {
    const { layout } = useLayoutStore.getState();
    const { activeLayerId, activeCategoryId } = useSelectionStore.getState();

    return {
      getGridCoords: vi.fn(() => null),
      clampCoords: vi.fn((c: Coord) => c),
      isInBounds: vi.fn(() => true),
      gridRef: mockGridRef,
      layout,
      activeLayerId,
      activeCategoryId,
      paintSize: paintSize ?? null,
      selectedBinIds: [],
      setInteraction: mockSetInteraction,
      setDropTarget: vi.fn(),
      setSelectedBin: mockSetSelectedBin,
      setSelectedBins: mockSetSelectedBins,
      addBin: mockAddBin,
      updateBin: vi.fn(),
      deleteBin: vi.fn(),
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
    useInteractionStore.setState({ paintSize: null, interaction: null });
  });

  describe('single-click placement in paint mode', () => {
    it('places a single bin when clicking without dragging', () => {
      const paintSize = { width: 2, depth: 3 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      // Set up paint interaction where start === current (single click)
      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(2, 2),
          current: coord(2, 2),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      const binData = mockAddBin.mock.calls[0][0];
      expect(binData.width).toBe(2);
      expect(binData.depth).toBe(3);
      expect(mockSetSelectedBin).toHaveBeenCalledWith('new-bin-id');
    });

    it('centers the bin on the clicked position', () => {
      const paintSize = { width: 3, depth: 3 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      // Click at position (5, 5) on a 10x8 grid
      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(5, 5),
          current: coord(5, 5),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      const binData = mockAddBin.mock.calls[0][0];
      // 3x3 bin centered on (5,5): x = floor(5 - (3-1)/2) = floor(4) = 4, y = floor(5 - (3-1)/2) = 4
      expect(binData.x).toBe(4);
      expect(binData.y).toBe(4);
    });

    it('clamps bin position to drawer bounds when clicking near edge', () => {
      const paintSize = { width: 3, depth: 3 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      // Click at position (9, 7) on a 10x8 grid — bin would extend past edge
      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(9, 7),
          current: coord(9, 7),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      const binData = mockAddBin.mock.calls[0][0];
      // Clamped: x = min(centered, drawer.width - 3) = min(8, 7) = 7
      // Clamped: y = min(centered, drawer.depth - 3) = min(6, 5) = 5
      expect(binData.x).toBe(7);
      expect(binData.y).toBe(5);
    });

    it('clamps bin position to zero when clicking near origin', () => {
      const paintSize = { width: 4, depth: 4 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      // Click at (0, 0) — centering would go negative
      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(0, 0),
          current: coord(0, 0),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      const binData = mockAddBin.mock.calls[0][0];
      // Centered: floor(0 - (4-1)/2) = floor(-1.5) = -2, clamped to 0
      expect(binData.x).toBe(0);
      expect(binData.y).toBe(0);
    });

    it('places 1x1 bin exactly at clicked position', () => {
      const paintSize = { width: 1, depth: 1 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(3, 4),
          current: coord(3, 4),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      const binData = mockAddBin.mock.calls[0][0];
      // 1x1 centered on (3,4): x = floor(3 - 0/2) = 3, y = floor(4 - 0/2) = 4
      expect(binData.x).toBe(3);
      expect(binData.y).toBe(4);
    });

    it('supports half-bin mode with snapping', () => {
      useHalfGridModeStore.setState({ halfGridMode: true });
      const paintSize = { width: 1.5, depth: 1 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(3, 3),
          current: coord(3, 3),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      const binData = mockAddBin.mock.calls[0][0];
      // Half-bin: minSize = 0.5, centered: snapToHalf(3 - (1.5 - 0.5)/2) = snapToHalf(2.5) = 2.5
      expect(binData.x).toBe(2.5);
      expect(binData.width).toBe(1.5);
    });

    it('does not place bin when addBin fails (collision)', () => {
      const paintSize = { width: 2, depth: 2 };
      mockAddBin.mockReturnValue({ ok: false, error: { type: 'collision' } });

      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(3, 3),
          current: coord(3, 3),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      expect(mockSetSelectedBin).not.toHaveBeenCalled();
    });
  });

  describe('fits-gap selection', () => {
    it('derives the gap constraint from the drawn selection and opens the gallery', () => {
      useInteractionStore.setState({
        interaction: {
          type: 'draw',
          start: coord(2, 3),
          current: coord(4, 4),
          fitsGap: 'right-drag',
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext()));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).not.toHaveBeenCalled();
      const { layout } = useLayoutStore.getState();
      const constraint = useGapFitStore.getState().constraint;
      expect(constraint).toEqual({
        maxWidth: 3,
        maxDepth: 2,
        // Single layer at z-start 0: the full drawer height remains.
        maxHeight: layout.drawer.height,
        gridUnitMm: layout.gridUnitMm,
        gridUnitMmY: layout.gridUnitMm,
        heightUnitMm: layout.heightUnitMm,
        targetPosition: { x: 2, y: 3, layerId: layout.layers[0].id },
      });
      expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
    });

    it('derives half-grid constraints at 0.5 steps', () => {
      useHalfGridModeStore.setState({ halfGridMode: true });
      useInteractionStore.setState({
        interaction: {
          type: 'draw',
          start: coord(1.5, 2),
          current: coord(2.5, 3.5),
          fitsGap: 'right-drag',
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext()));

      act(() => {
        result.current.handleUp();
      });

      const constraint = useGapFitStore.getState().constraint;
      expect(constraint?.maxWidth).toBe(1.5);
      expect(constraint?.maxDepth).toBe(2);
      expect(constraint?.targetPosition.x).toBe(1.5);
      expect(constraint?.targetPosition.y).toBe(2);
    });

    it('toasts and bails without opening the gallery when the region is not empty', () => {
      const { layout } = useLayoutStore.getState();
      useLayoutStore.setState({
        layout: {
          ...layout,
          bins: [
            createTestBin({
              id: binId('blocker'),
              layerId: layout.layers[0].id,
              category: layout.categories[0].id,
              x: gridUnits(2),
              y: gridUnits(2),
              width: gridUnits(2),
              depth: gridUnits(2),
              height: heightUnits(3),
            }),
          ],
        },
      });
      useInteractionStore.setState({
        interaction: { type: 'draw', start: coord(2, 2), current: coord(2, 2), fitsGap: 'armed' },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext()));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).not.toHaveBeenCalled();
      expect(useGapFitStore.getState().constraint).toBeNull();
      expect(useBinExampleGalleryStore.getState().isOpen).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].type).toBe('error');
    });

    it('a stationary right-click is not a gap selection (context menu falls through)', () => {
      useInteractionStore.setState({
        interaction: {
          type: 'draw',
          start: coord(2, 2),
          current: coord(2, 2),
          fitsGap: 'right-drag',
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext()));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).not.toHaveBeenCalled();
      expect(useGapFitStore.getState().constraint).toBeNull();
      expect(useBinExampleGalleryStore.getState().isOpen).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('an armed single tap selects a minimum-size gap and disarms the mode', () => {
      useInteractionStore.setState({
        gapSelectArmed: true,
        interaction: { type: 'draw', start: coord(2, 2), current: coord(2, 2), fitsGap: 'armed' },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext()));

      act(() => {
        result.current.handleUp();
      });

      const constraint = useGapFitStore.getState().constraint;
      expect(constraint?.maxWidth).toBe(1);
      expect(constraint?.maxDepth).toBe(1);
      expect(constraint?.targetPosition).toMatchObject({ x: 2, y: 2 });
      expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
      expect(useInteractionStore.getState().gapSelectArmed).toBe(false);
    });

    it('a plain draw leaves the gap handoff untouched', () => {
      mockAddBin.mockReturnValue(ok('new-bin-id'));
      useInteractionStore.setState({
        interaction: { type: 'draw', start: coord(0, 0), current: coord(1, 1) },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext()));

      act(() => {
        result.current.handleUp();
      });

      expect(mockAddBin).toHaveBeenCalledTimes(1);
      expect(useGapFitStore.getState().constraint).toBeNull();
      expect(useBinExampleGalleryStore.getState().isOpen).toBe(false);
    });
  });

  describe('drag-area paint mode (existing behavior)', () => {
    it('uses area fill when start differs from current', () => {
      const paintSize = { width: 2, depth: 2 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      // Drag from (0,0) to (3,3) — selects an area, NOT a single click
      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: coord(0, 0),
          current: coord(3, 3),
        },
      });

      const { result } = renderHook(() => useDrawInteraction(createContext(paintSize)));

      act(() => {
        result.current.handleUp();
      });

      // Area is 4x4, fits 2x2 bins → 4 bins (2 across × 2 down)
      expect(mockAddBin).toHaveBeenCalledTimes(4);
    });
  });
});
