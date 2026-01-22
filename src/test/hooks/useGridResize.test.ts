import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridResize } from '@/features/grid-editor/hooks/useGridResize';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import { isOk } from '@/core/result';

// Helper to extract bin ID from Result
function getBinId(
  result: ReturnType<typeof useLayoutStore.getState>['addBin'] extends (
    ...args: unknown[]
  ) => infer R
    ? R
    : never
): string {
  if (!isOk(result)) throw new Error('addBin failed');
  return result.value;
}

describe('useGridResize', () => {
  const HINT_KEY = 'gridfinity-grid-resize-hint-shown';

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset stores
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
    // Clear localStorage
    localStorage.removeItem(HINT_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(HINT_KEY);
  });

  describe('initial state', () => {
    it('returns null resizeDirection when not resizing', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      expect(result.current.resizeDirection).toBeNull();
    });

    it('returns null pendingResize when no resize pending', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      expect(result.current.pendingResize).toBeNull();
    });
  });

  describe('pulse animation for first-use hint', () => {
    it('starts pulsing resize handles on first load', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // Initially false
      expect(result.current.shouldPulseResizeHandles).toBe(false);

      // After timeout, should be true
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.shouldPulseResizeHandles).toBe(true);
    });

    it('stops pulsing after 3 seconds', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // Start pulsing
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.shouldPulseResizeHandles).toBe(true);

      // Wait 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.shouldPulseResizeHandles).toBe(false);
    });

    it('does not pulse if hint was already shown', () => {
      localStorage.setItem(HINT_KEY, 'true');

      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.shouldPulseResizeHandles).toBe(false);
    });

    it('sets localStorage flag after first load', () => {
      renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // Flag should be set immediately on mount
      expect(localStorage.getItem(HINT_KEY)).toBe('true');
    });
  });

  describe('handleResizeStart', () => {
    it('sets resizeDirection to width', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleResizeStart('width', mockEvent);
      });

      expect(result.current.resizeDirection).toBe('width');
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('sets resizeDirection to depth', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleResizeStart('depth', mockEvent);
      });

      expect(result.current.resizeDirection).toBe('depth');
    });

    it('sets resizeDirection to both', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleResizeStart('both', mockEvent);
      });

      expect(result.current.resizeDirection).toBe('both');
    });
  });

  describe('mouse move during resize', () => {
    it('updates drawer width on horizontal drag', () => {
      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap; // 34

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      const initialWidth = useLayoutStore.getState().layout.drawer.width;

      // Start resize
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Simulate mouse move (2 cells to the right)
      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: cellStep * 2,
          clientY: 0,
        });
        document.dispatchEvent(moveEvent);
      });

      const newWidth = useLayoutStore.getState().layout.drawer.width;
      expect(newWidth).toBe(initialWidth + 2);
    });

    it('updates drawer depth on vertical drag', () => {
      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap;

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      const initialDepth = useLayoutStore.getState().layout.drawer.depth;

      // Start resize
      act(() => {
        result.current.handleResizeStart('depth', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Simulate mouse move (3 cells down)
      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: 0,
          clientY: cellStep * 3,
        });
        document.dispatchEvent(moveEvent);
      });

      const newDepth = useLayoutStore.getState().layout.drawer.depth;
      expect(newDepth).toBe(initialDepth + 3);
    });

    it('updates both dimensions when direction is both', () => {
      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap;

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      const drawer = useLayoutStore.getState().layout.drawer;
      const initialWidth = drawer.width;
      const initialDepth = drawer.depth;

      // Start resize
      act(() => {
        result.current.handleResizeStart('both', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Simulate diagonal mouse move
      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: cellStep * 2,
          clientY: cellStep * 3,
        });
        document.dispatchEvent(moveEvent);
      });

      const newDrawer = useLayoutStore.getState().layout.drawer;
      expect(newDrawer.width).toBe(initialWidth + 2);
      expect(newDrawer.depth).toBe(initialDepth + 3);
    });

    it('clamps width to minimum 1', () => {
      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap;

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      // Start resize
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Simulate large negative move
      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: -cellStep * 100,
          clientY: 0,
        });
        document.dispatchEvent(moveEvent);
      });

      const newWidth = useLayoutStore.getState().layout.drawer.width;
      expect(newWidth).toBeGreaterThanOrEqual(1);
    });

    it('clamps width to maximum 50', () => {
      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap;

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      // Start resize
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Simulate large positive move
      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: cellStep * 100,
          clientY: 0,
        });
        document.dispatchEvent(moveEvent);
      });

      const newWidth = useLayoutStore.getState().layout.drawer.width;
      expect(newWidth).toBeLessThanOrEqual(50);
    });
  });

  describe('mouse up completes resize', () => {
    it('clears resize direction on mouse up', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // Start resize
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      expect(result.current.resizeDirection).toBe('width');

      // Mouse up
      act(() => {
        const upEvent = new MouseEvent('mouseup');
        document.dispatchEvent(upEvent);
      });

      expect(result.current.resizeDirection).toBeNull();
    });
  });

  describe('clipped bins detection', () => {
    it('does not show pending resize when no bins clipped', () => {
      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap;

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      // Start resize with no bins
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Increase size (no clipping possible)
      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: cellStep * 2,
          clientY: 0,
        });
        document.dispatchEvent(moveEvent);
      });

      // Complete resize
      act(() => {
        const upEvent = new MouseEvent('mouseup');
        document.dispatchEvent(upEvent);
      });

      // No pending resize needed
      expect(result.current.pendingResize).toBeNull();
    });

    it('ignores bins in staging when calculating clipped bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      // Add bin to staging (not affected by grid resize)
      getBinId(
        addBin({
          layerId: STAGING_ID,
          x: 100, // Out of bounds but in staging
          y: 100,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: 'Staged bin',
          notes: '',
        })
      );

      const cellSize = 32;
      const gap = 2;
      const cellStep = cellSize + gap;

      const { result } = renderHook(() => useGridResize({ cellSize, gap }));

      // Reduce grid size
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      act(() => {
        const moveEvent = new MouseEvent('mousemove', {
          clientX: -cellStep * 5,
          clientY: 0,
        });
        document.dispatchEvent(moveEvent);
      });

      act(() => {
        const upEvent = new MouseEvent('mouseup');
        document.dispatchEvent(upEvent);
      });

      // Should not have pending resize (staging bins ignored)
      expect(result.current.pendingResize).toBeNull();
    });
  });

  describe('confirmResize', () => {
    it('does nothing when no pending resize', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // No pending resize
      expect(result.current.pendingResize).toBeNull();

      // Confirm should not throw
      act(() => {
        result.current.confirmResize();
      });

      expect(result.current.pendingResize).toBeNull();
    });
  });

  describe('cancelResize', () => {
    it('does nothing when no pending resize', () => {
      const { result } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // No pending resize
      expect(result.current.pendingResize).toBeNull();

      // Cancel should not throw
      act(() => {
        result.current.cancelResize();
      });

      expect(result.current.pendingResize).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { result, unmount } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // Start resize
      act(() => {
        result.current.handleResizeStart('width', {
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as React.MouseEvent);
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it('clears timeouts on unmount', () => {
      const { unmount } = renderHook(() => useGridResize({ cellSize: 32, gap: 2 }));

      // Unmount before timers fire
      expect(() => unmount()).not.toThrow();

      // Advance timers - should not cause errors
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    });
  });
});
