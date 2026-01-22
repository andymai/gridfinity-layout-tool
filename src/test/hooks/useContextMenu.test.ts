import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenu } from '@/hooks/useContextMenu';

// Timing constants for context menu outside click handling
// The hook uses a 100ms delay before attaching the outside click listener
const AFTER_DELAY_MS = 150; // Time to advance past the 100ms delay
const BEFORE_DELAY_MS = 50; // Time within the 100ms delay window

describe('useContextMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with menu closed', () => {
      const { result } = renderHook(() => useContextMenu());

      expect(result.current.isOpen).toBe(false);
    });

    it('starts with position at origin', () => {
      const { result } = renderHook(() => useContextMenu());

      expect(result.current.position).toEqual({ x: 0, y: 0 });
    });

    it('provides a menuRef', () => {
      const { result } = renderHook(() => useContextMenu());

      expect(result.current.menuRef).toBeDefined();
      expect(result.current.menuRef.current).toBeNull();
    });
  });

  describe('show()', () => {
    it('opens the menu', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: 100, y: 200 });
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('sets the position', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: 150, y: 250 });
      });

      expect(result.current.position).toEqual({ x: 150, y: 250 });
    });

    it('can be called multiple times to update position', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: 100, y: 100 });
      });
      expect(result.current.position).toEqual({ x: 100, y: 100 });

      act(() => {
        result.current.show({ x: 200, y: 300 });
      });
      expect(result.current.position).toEqual({ x: 200, y: 300 });
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('hide()', () => {
    it('closes the menu', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: 100, y: 200 });
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.hide();
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('can be called when already closed (no-op)', () => {
      const { result } = renderHook(() => useContextMenu());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.hide();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('outside click handling', () => {
    it('closes menu when clicking outside after delay', () => {
      const { result } = renderHook(() => useContextMenu());

      // Create a mock menu element (so the handler can check menuRef.current)
      const menuElement = document.createElement('div');
      document.body.appendChild(menuElement);

      // Manually set the ref (same way React does)
      result.current.menuRef.current = menuElement;

      // Open the menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });
      expect(result.current.isOpen).toBe(true);

      // Advance past the delay
      act(() => {
        vi.advanceTimersByTime(AFTER_DELAY_MS);
      });

      // Simulate a click outside (on document body, not the menu)
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      act(() => {
        const event = new PointerEvent('pointerdown', { bubbles: true });
        Object.defineProperty(event, 'target', { value: outsideElement });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);

      // Cleanup
      document.body.removeChild(menuElement);
      document.body.removeChild(outsideElement);
    });

    it('does NOT close menu immediately (before delay)', () => {
      const { result } = renderHook(() => useContextMenu());

      // Open the menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });
      expect(result.current.isOpen).toBe(true);

      // Fire event before delay elapses (simulates triggering right-click)
      act(() => {
        vi.advanceTimersByTime(BEFORE_DELAY_MS);
      });

      act(() => {
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      });

      // Menu should still be open because listener isn't attached yet
      expect(result.current.isOpen).toBe(true);
    });

    it('does NOT close menu when clicking inside menuRef', () => {
      const { result } = renderHook(() => useContextMenu());

      // Create a mock menu element
      const menuElement = document.createElement('div');
      document.body.appendChild(menuElement);

      // Manually set the ref (same way React does)
      result.current.menuRef.current = menuElement;

      // Open the menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });

      // Advance past the delay
      act(() => {
        vi.advanceTimersByTime(AFTER_DELAY_MS);
      });

      // Create and dispatch event from inside the menu
      act(() => {
        const event = new PointerEvent('pointerdown', { bubbles: true });
        Object.defineProperty(event, 'target', { value: menuElement });
        menuElement.dispatchEvent(event);
      });

      // Menu should still be open
      expect(result.current.isOpen).toBe(true);

      // Cleanup
      document.body.removeChild(menuElement);
    });

    it('does NOT add listener when menu is closed', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      const { result } = renderHook(() => useContextMenu());

      // Menu is closed by default
      expect(result.current.isOpen).toBe(false);

      // Advance time - no listener should be added since menu is closed
      act(() => {
        vi.advanceTimersByTime(AFTER_DELAY_MS * 2);
      });

      // Check that pointerdown listener was not added
      const pointerdownCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'pointerdown'
      );
      expect(pointerdownCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });
  });

  describe('escape key handling', () => {
    it('closes menu when Escape is pressed', () => {
      const { result } = renderHook(() => useContextMenu());

      // Open the menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });
      expect(result.current.isOpen).toBe(true);

      // Press Escape
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('does NOT close menu on other key presses', () => {
      const { result } = renderHook(() => useContextMenu());

      // Open the menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });
      expect(result.current.isOpen).toBe(true);

      // Press other keys
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      });

      // Menu should still be open
      expect(result.current.isOpen).toBe(true);
    });

    it('does NOT add keydown listener when menu is closed', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useContextMenu());

      // Check that keydown listener was not added (menu starts closed)
      const keydownCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'keydown'
      );
      expect(keydownCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners when menu is closed', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { result } = renderHook(() => useContextMenu());

      // Open menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });

      // Advance past delay to add listener
      act(() => {
        vi.advanceTimersByTime(AFTER_DELAY_MS);
      });

      // Close menu
      act(() => {
        result.current.hide();
      });

      // Should have removed the pointerdown listener
      const pointerdownCalls = removeEventListenerSpy.mock.calls.filter(
        call => call[0] === 'pointerdown'
      );
      expect(pointerdownCalls.length).toBeGreaterThan(0);

      removeEventListenerSpy.mockRestore();
    });

    it('clears timeout when menu is closed before delay', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { result } = renderHook(() => useContextMenu());

      // Open menu
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });

      // Close before delay
      act(() => {
        vi.advanceTimersByTime(BEFORE_DELAY_MS);
        result.current.hide();
      });

      // Should have cleared the timeout
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { result, unmount } = renderHook(() => useContextMenu());

      // Open menu to add listeners
      act(() => {
        result.current.show({ x: 100, y: 200 });
      });

      // Advance past delay
      act(() => {
        vi.advanceTimersByTime(AFTER_DELAY_MS);
      });

      // Unmount
      unmount();

      // Should have removed keydown listener
      const keydownCalls = removeEventListenerSpy.mock.calls.filter(
        call => call[0] === 'keydown'
      );
      expect(keydownCalls.length).toBeGreaterThan(0);

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('ref behavior', () => {
    it('menuRef persists across re-renders', () => {
      const { result, rerender } = renderHook(() => useContextMenu());

      const initialRef = result.current.menuRef;

      rerender();

      expect(result.current.menuRef).toBe(initialRef);
    });
  });

  describe('position handling', () => {
    it('preserves position after hide/show cycle', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: 100, y: 200 });
      });
      expect(result.current.position).toEqual({ x: 100, y: 200 });

      act(() => {
        result.current.hide();
      });
      // Position is preserved even when closed
      expect(result.current.position).toEqual({ x: 100, y: 200 });

      // But when shown again, new position takes effect
      act(() => {
        result.current.show({ x: 300, y: 400 });
      });
      expect(result.current.position).toEqual({ x: 300, y: 400 });
    });

    it('handles negative positions', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: -10, y: -20 });
      });

      expect(result.current.position).toEqual({ x: -10, y: -20 });
    });

    it('handles decimal positions', () => {
      const { result } = renderHook(() => useContextMenu());

      act(() => {
        result.current.show({ x: 100.5, y: 200.75 });
      });

      expect(result.current.position).toEqual({ x: 100.5, y: 200.75 });
    });
  });
});
