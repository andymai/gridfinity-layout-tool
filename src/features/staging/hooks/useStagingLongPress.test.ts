import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStagingLongPress } from './useStagingLongPress';
import { binId } from '@/core/types';

describe('useStagingLongPress', () => {
  const mockShowContextMenu = vi.fn();
  let mockVibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock navigator.vibrate
    mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderLongPressHook(isTouchDevice: boolean) {
    return renderHook(() =>
      useStagingLongPress({
        isTouchDevice,
        showContextMenu: mockShowContextMenu,
      })
    );
  }

  describe('initial state', () => {
    it('should have longPressTriggeredRef set to false', () => {
      const { result } = renderLongPressHook(true);
      expect(result.current.longPressTriggeredRef.current).toBe(false);
    });
  });

  describe('startLongPress on touch device', () => {
    it('should start timer and trigger context menu after 500ms', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
      expect(result.current.longPressTriggeredRef.current).toBe(false);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.longPressTriggeredRef.current).toBe(true);
      expect(mockShowContextMenu).toHaveBeenCalledWith([testBinId], { x: 100, y: 200 }, 'staging');
    });

    it('should call navigator.vibrate when long-press triggers', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockVibrate).toHaveBeenCalledWith(50);
    });

    it('should not call navigator.vibrate if not supported', () => {
      // Remove vibrate support by deleting the property
      const originalVibrate = navigator.vibrate;
      // @ts-expect-error - Deleting property to simulate unsupported browser
      delete navigator.vibrate;

      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).toHaveBeenCalled();
      // No error should be thrown

      // Restore original value
      if (originalVibrate !== undefined) {
        Object.defineProperty(navigator, 'vibrate', {
          value: originalVibrate,
          writable: true,
          configurable: true,
        });
      }
    });

    it('should not trigger context menu before 500ms', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
        vi.advanceTimersByTime(499);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
      expect(result.current.longPressTriggeredRef.current).toBe(false);
    });
  });

  describe('startLongPress on non-touch device', () => {
    it('should not start timer or trigger context menu', () => {
      const { result } = renderLongPressHook(false);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
        vi.advanceTimersByTime(1000);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
      expect(result.current.longPressTriggeredRef.current).toBe(false);
    });
  });

  describe('handlePointerMove', () => {
    it('should not cancel long-press with small movement (<10px)', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Move 9px (under threshold)
      act(() => {
        result.current.handlePointerMove(109, 200);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).toHaveBeenCalled();
    });

    it('should cancel long-press with large horizontal movement (>10px)', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Move 11px horizontally (over threshold)
      act(() => {
        result.current.handlePointerMove(111, 200);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
      expect(result.current.longPressTriggeredRef.current).toBe(false);
    });

    it('should cancel long-press with large vertical movement (>10px)', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Move 11px vertically (over threshold)
      act(() => {
        result.current.handlePointerMove(100, 211);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
    });

    it('should cancel long-press with diagonal movement (>10px)', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Move diagonally 8px x 8px (distance = ~11.3px, over threshold)
      act(() => {
        result.current.handlePointerMove(108, 208);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
    });

    it('should do nothing if no pointer start position is set', () => {
      const { result } = renderLongPressHook(true);

      // Call handlePointerMove without startLongPress
      act(() => {
        result.current.handlePointerMove(100, 200);
      });

      // Should not throw or cause issues
      expect(mockShowContextMenu).not.toHaveBeenCalled();
    });
  });

  describe('handlePointerEnd', () => {
    it('should clear timer and reset pointer start', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      act(() => {
        result.current.handlePointerEnd();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
      expect(result.current.longPressTriggeredRef.current).toBe(false);
    });

    it('should allow subsequent pointer moves to do nothing after pointer end', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
        result.current.handlePointerEnd();
      });

      // This should not cause any issues since pointerStartRef is null
      act(() => {
        result.current.handlePointerMove(200, 300);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
    });
  });

  describe('multiple rapid calls', () => {
    it('should reset previous state when startLongPress is called again', () => {
      const { result } = renderLongPressHook(true);
      const testBinId1 = binId('bin-1');
      const testBinId2 = binId('bin-2');

      // Start first long-press
      act(() => {
        result.current.startLongPress(testBinId1, 100, 200);
      });

      // Advance halfway
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Start second long-press (should cancel first)
      act(() => {
        result.current.startLongPress(testBinId2, 150, 250);
      });

      // Advance another 250ms (total 500ms from start)
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // First bin should not trigger
      expect(mockShowContextMenu).not.toHaveBeenCalled();
      expect(result.current.longPressTriggeredRef.current).toBe(false);

      // Advance remaining 250ms for second press
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Second bin should trigger
      expect(mockShowContextMenu).toHaveBeenCalledWith([testBinId2], { x: 150, y: 250 }, 'staging');
      expect(result.current.longPressTriggeredRef.current).toBe(true);
    });

    it('should reset longPressTriggeredRef on each startLongPress call', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      // Trigger long-press
      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
        vi.advanceTimersByTime(500);
      });

      expect(result.current.longPressTriggeredRef.current).toBe(true);

      // Start new long-press
      act(() => {
        result.current.startLongPress(testBinId, 110, 210);
      });

      // Should reset to false
      expect(result.current.longPressTriggeredRef.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle exact 10px movement (boundary)', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Move exactly 10px horizontally
      act(() => {
        result.current.handlePointerMove(110, 200);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should not cancel (threshold is > 10, not >= 10)
      expect(mockShowContextMenu).toHaveBeenCalled();
    });

    it('should handle zero movement', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // No movement
      act(() => {
        result.current.handlePointerMove(100, 200);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).toHaveBeenCalled();
    });

    it('should handle negative coordinate movement', () => {
      const { result } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Move 11px in negative direction
      act(() => {
        result.current.handlePointerMove(89, 200);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockShowContextMenu).not.toHaveBeenCalled();
    });
  });

  describe('cleanup on unmount', () => {
    it('should clear pending timer when unmounted', () => {
      const { result, unmount } = renderLongPressHook(true);
      const testBinId = binId('bin-1');

      // Start a long-press (timer is pending)
      act(() => {
        result.current.startLongPress(testBinId, 100, 200);
      });

      // Unmount before timer fires
      unmount();

      // Advance past the duration
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Context menu should NOT have been called (timer was cleaned up)
      expect(mockShowContextMenu).not.toHaveBeenCalled();
    });
  });
});
