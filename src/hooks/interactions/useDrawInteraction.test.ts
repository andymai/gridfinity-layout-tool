import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawInteraction } from '@/hooks/interactions/useDrawInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfBinModeStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { ok } from '@/core/result';
import type { InteractionContext } from '@/hooks/interactions/types';

// Mock analytics to avoid side effects
vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackPlacement: vi.fn(),
    trackBulk: vi.fn(),
    trackRejection: vi.fn(),
    recordCreation: vi.fn(),
  },
}));
vi.mock('@/shared/analytics/posthog', () => ({
  trackBinCreated: vi.fn(),
  trackPaintMode: vi.fn(),
}));

describe('useDrawInteraction', () => {
  const mockSetInteraction = vi.fn();
  const mockSetSelectedBin = vi.fn();
  const mockSetSelectedBins = vi.fn();
  const mockAddBin = vi.fn();
  const mockExecute = vi.fn((fn: () => void) => fn());
  const mockActivePointerIdRef = { current: null };
  const mockCapturedPointerRef = { current: null };

  const createContext = (paintSize?: { width: number; depth: number }): InteractionContext => {
    const { layout } = useLayoutStore.getState();
    const { activeLayerId, activeCategoryId } = useSelectionStore.getState();

    return {
      layout,
      activeLayerId,
      activeCategoryId,
      paintSize: paintSize ?? null,
      setInteraction: mockSetInteraction,
      setSelectedBin: mockSetSelectedBin,
      setSelectedBins: mockSetSelectedBins,
      addBin: mockAddBin,
      execute: mockExecute,
      activePointerIdRef: mockActivePointerIdRef,
      capturedPointerRef: mockCapturedPointerRef,
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
          start: { x: 2, y: 2 },
          current: { x: 2, y: 2 },
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
          start: { x: 5, y: 5 },
          current: { x: 5, y: 5 },
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
          start: { x: 9, y: 7 },
          current: { x: 9, y: 7 },
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
          start: { x: 0, y: 0 },
          current: { x: 0, y: 0 },
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
          start: { x: 3, y: 4 },
          current: { x: 3, y: 4 },
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
      useHalfBinModeStore.setState({ halfBinMode: true });
      const paintSize = { width: 1.5, depth: 1 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: { x: 3, y: 3 },
          current: { x: 3, y: 3 },
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
          start: { x: 3, y: 3 },
          current: { x: 3, y: 3 },
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

  describe('drag-area paint mode (existing behavior)', () => {
    it('uses area fill when start differs from current', () => {
      const paintSize = { width: 2, depth: 2 };
      mockAddBin.mockReturnValue(ok('new-bin-id'));

      // Drag from (0,0) to (3,3) — selects an area, NOT a single click
      useInteractionStore.setState({
        interaction: {
          type: 'paint',
          paintSize,
          start: { x: 0, y: 0 },
          current: { x: 3, y: 3 },
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
