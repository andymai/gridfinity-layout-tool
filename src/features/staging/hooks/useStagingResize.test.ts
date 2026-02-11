import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';
import {
  useStagingResize,
  MIN_STASH_HEIGHT,
  MAX_STASH_HEIGHT_VH,
} from '@/features/staging/hooks/useStagingResize';

describe('useStagingResize', () => {
  let mockScrollContainer: HTMLDivElement;
  let mockResizeHandle: HTMLDivElement;
  let scrollContainerRef: RefObject<HTMLDivElement | null>;
  let resizeHandleRef: RefObject<HTMLDivElement | null>;
  let updateSetting: ReturnType<typeof vi.fn>;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Mock DOM elements
    mockScrollContainer = {
      offsetHeight: 200,
      style: { maxHeight: '' },
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as HTMLDivElement;

    mockResizeHandle = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as HTMLDivElement;

    // Create refs
    scrollContainerRef = { current: mockScrollContainer };
    resizeHandleRef = { current: mockResizeHandle };

    // Mock updateSetting
    updateSetting = vi.fn();

    // Mock window.innerHeight
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    // Restore window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe('initial state', () => {
    it('isResizing is false', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      expect(result.current.isResizing).toBe(false);
    });
  });

  describe('handleResizePointerDown', () => {
    it('captures pointer on resize handle', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientY: 100,
        pointerId: 1,
      } as unknown as ReactPointerEvent;

      act(() => {
        result.current.handleResizePointerDown(mockEvent);
      });

      expect(mockResizeHandle.setPointerCapture).toHaveBeenCalledWith(1);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('sets isResizing to true', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientY: 100,
        pointerId: 1,
      } as unknown as ReactPointerEvent;

      act(() => {
        result.current.handleResizePointerDown(mockEvent);
      });

      expect(result.current.isResizing).toBe(true);
    });

    it('does nothing when resize handle ref is null', () => {
      const nullHandleRef: RefObject<HTMLDivElement | null> = { current: null };

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef: nullHandleRef,
          updateSetting,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientY: 100,
        pointerId: 1,
      } as unknown as ReactPointerEvent;

      act(() => {
        result.current.handleResizePointerDown(mockEvent);
      });

      expect(result.current.isResizing).toBe(false);
    });

    it('uses default height of 200 when scroll container is null', () => {
      const nullScrollRef: RefObject<HTMLDivElement | null> = { current: null };

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef: nullScrollRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientY: 100,
        pointerId: 1,
      } as unknown as ReactPointerEvent;

      act(() => {
        result.current.handleResizePointerDown(mockEvent);
      });

      expect(result.current.isResizing).toBe(true);

      // Move pointer up by 50px (should increase height to 200 + 50 = 250)
      const moveEvent = {
        preventDefault: vi.fn(),
        clientY: 50,
      } as unknown as ReactPointerEvent;

      act(() => {
        result.current.handleResizePointerMove(moveEvent);
      });

      // Can't verify the actual calculation without scroll container, but isResizing should still be true
      expect(result.current.isResizing).toBe(true);
    });
  });

  describe('handleResizePointerMove', () => {
    it('updates scrollContainer maxHeight when resizing', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize at y=300
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Move pointer up to y=200 (dy = 300 - 200 = 100, so new height = 200 + 100 = 300)
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 200,
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe('300px');
    });

    it('increases height when dragging up (negative dy)', () => {
      mockScrollContainer.offsetHeight = 200;

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize at y=300
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Move up by 50px (dy = 50, new height = 200 + 50 = 250)
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 250,
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe('250px');
    });

    it('decreases height when dragging down (positive dy)', () => {
      mockScrollContainer.offsetHeight = 200;

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize at y=300
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Move down by 50px (dy = -50, new height = 200 - 50 = 150)
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 350,
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe('150px');
    });

    it('clamps height to MIN_STASH_HEIGHT', () => {
      mockScrollContainer.offsetHeight = 200;

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize at y=300
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Try to resize to negative height by dragging way down
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 1000, // Large positive move
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe(`${MIN_STASH_HEIGHT}px`);
    });

    it('clamps height to MAX_STASH_HEIGHT_VH percent of viewport', () => {
      mockScrollContainer.offsetHeight = 200;
      window.innerHeight = 1000;
      const maxHeight = 1000 * (MAX_STASH_HEIGHT_VH / 100); // 900

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize at y=300
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Try to resize beyond max by dragging way up
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: -1000, // Large negative move
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe(`${maxHeight}px`);
    });

    it('does nothing when not resizing', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      const initialMaxHeight = mockScrollContainer.style.maxHeight;

      // Try to move without starting resize
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 200,
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe(initialMaxHeight);
    });

    it('prevents default on pointer move event', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      const moveEvent = {
        preventDefault: vi.fn(),
        clientY: 250,
      } as unknown as ReactPointerEvent;

      act(() => {
        result.current.handleResizePointerMove(moveEvent);
      });

      expect(moveEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('handleResizePointerUp', () => {
    it('releases pointer capture on resize handle', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // End resize
      act(() => {
        result.current.handleResizePointerUp();
      });

      expect(mockResizeHandle.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('persists final height to settings', () => {
      mockScrollContainer.offsetHeight = 300;

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Move to resize
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 200,
        } as unknown as ReactPointerEvent);
      });

      // Update offsetHeight to reflect the new height
      mockScrollContainer.offsetHeight = 400;

      // End resize
      act(() => {
        result.current.handleResizePointerUp();
      });

      expect(updateSetting).toHaveBeenCalledWith('stashMaxHeight', 400);
    });

    it('sets isResizing to false', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      expect(result.current.isResizing).toBe(true);

      // End resize
      act(() => {
        result.current.handleResizePointerUp();
      });

      expect(result.current.isResizing).toBe(false);
    });

    it('does nothing when not resizing', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Try to end resize without starting
      act(() => {
        result.current.handleResizePointerUp();
      });

      expect(mockResizeHandle.releasePointerCapture).not.toHaveBeenCalled();
      expect(updateSetting).not.toHaveBeenCalled();
    });

    it('handles null resize handle gracefully', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Set ref to null before ending resize
      resizeHandleRef.current = null;

      // Should not throw
      expect(() => {
        act(() => {
          result.current.handleResizePointerUp();
        });
      }).not.toThrow();

      expect(result.current.isResizing).toBe(false);
    });

    it('handles null scroll container gracefully', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Set ref to null before ending resize
      scrollContainerRef.current = null;

      // Should not throw and should not call updateSetting
      expect(() => {
        act(() => {
          result.current.handleResizePointerUp();
        });
      }).not.toThrow();

      expect(updateSetting).not.toHaveBeenCalled();
    });
  });

  describe('handleResizeDoubleClick', () => {
    it('resets setting to null', () => {
      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      act(() => {
        result.current.handleResizeDoubleClick();
      });

      expect(updateSetting).toHaveBeenCalledWith('stashMaxHeight', null);
    });

    it('clears inline style maxHeight', () => {
      mockScrollContainer.style.maxHeight = '500px';

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      act(() => {
        result.current.handleResizeDoubleClick();
      });

      expect(mockScrollContainer.style.maxHeight).toBe('');
    });

    it('handles null scroll container gracefully', () => {
      const nullScrollRef: RefObject<HTMLDivElement | null> = { current: null };

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef: nullScrollRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Should not throw
      expect(() => {
        act(() => {
          result.current.handleResizeDoubleClick();
        });
      }).not.toThrow();

      expect(updateSetting).toHaveBeenCalledWith('stashMaxHeight', null);
    });
  });

  describe('cleanup', () => {
    it('does not throw on unmount', () => {
      const { unmount } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      expect(() => unmount()).not.toThrow();
    });

    it('does not throw on unmount during resize', () => {
      const { result, unmount } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('viewport calculations', () => {
    it('calculates max height based on window.innerHeight', () => {
      window.innerHeight = 800;
      const expectedMaxHeight = 800 * (MAX_STASH_HEIGHT_VH / 100); // 720

      mockScrollContainer.offsetHeight = 200;

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // Try to resize beyond max
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: -1000,
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe(`${expectedMaxHeight}px`);
    });

    it('updates max height when viewport changes between moves', () => {
      window.innerHeight = 1000;
      mockScrollContainer.offsetHeight = 200;

      const { result } = renderHook(() =>
        useStagingResize({
          scrollContainerRef,
          resizeHandleRef,
          updateSetting,
        })
      );

      // Start resize at y=300
      act(() => {
        result.current.handleResizePointerDown({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientY: 300,
          pointerId: 1,
        } as unknown as ReactPointerEvent);
      });

      // First move to y=100 (dy = 300 - 100 = 200, new height = 200 + 200 = 400)
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 100,
        } as unknown as ReactPointerEvent);
      });

      const firstMaxHeight = mockScrollContainer.style.maxHeight;
      expect(firstMaxHeight).toBe('400px');

      // Change viewport - max is now 500 * 0.9 = 450px
      window.innerHeight = 500;

      // Second move to y=50 (dy = 300 - 50 = 250, new height = 200 + 250 = 450)
      act(() => {
        result.current.handleResizePointerMove({
          preventDefault: vi.fn(),
          clientY: 50,
        } as unknown as ReactPointerEvent);
      });

      expect(mockScrollContainer.style.maxHeight).toBe('450px');
    });
  });
});
