import { useState, useRef, useCallback } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';
import { clamp } from '@/shared/utils';

/** Minimum height in pixels the stash can be resized to */
export const MIN_STASH_HEIGHT = 80;
/** Maximum height as percentage of viewport */
export const MAX_STASH_HEIGHT_VH = 90;

interface UseStagingResizeOptions {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  resizeHandleRef: RefObject<HTMLDivElement | null>;
  updateSetting: (key: 'stashMaxHeight', value: number | null) => void;
}

interface UseStagingResizeReturn {
  isResizing: boolean;
  handleResizePointerDown: (e: ReactPointerEvent) => void;
  handleResizePointerMove: (e: ReactPointerEvent) => void;
  handleResizePointerUp: () => void;
  handleResizeDoubleClick: () => void;
}

export function useStagingResize({
  scrollContainerRef,
  resizeHandleRef,
  updateSetting,
}: UseStagingResizeOptions): UseStagingResizeReturn {
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const capturedPointerIdRef = useRef<number | null>(null);

  const handleResizePointerDown = useCallback(
    (e: ReactPointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      // Use the resize handle ref for consistent pointer capture
      const handle = resizeHandleRef.current;
      if (!handle) return;
      handle.setPointerCapture(e.pointerId);
      capturedPointerIdRef.current = e.pointerId;
      setIsResizing(true);
      // Get current scroll container height
      const currentHeight = scrollContainerRef.current?.offsetHeight ?? 200;
      resizeStartRef.current = { y: e.clientY, height: currentHeight };
    },
    [resizeHandleRef, scrollContainerRef]
  );

  const handleResizePointerMove = useCallback(
    (e: ReactPointerEvent): void => {
      if (!isResizing || !resizeStartRef.current) return;
      e.preventDefault();
      // Dragging up (negative dy) increases height
      const dy = resizeStartRef.current.y - e.clientY;
      const maxHeight = window.innerHeight * (MAX_STASH_HEIGHT_VH / 100);
      const newHeight = clamp(resizeStartRef.current.height + dy, MIN_STASH_HEIGHT, maxHeight);
      // Apply immediately for smooth feedback
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.maxHeight = `${newHeight}px`;
      }
    },
    [isResizing, scrollContainerRef]
  );

  const handleResizePointerUp = useCallback((): void => {
    if (!isResizing) return;
    // Release pointer capture on the same element that captured it
    const handle = resizeHandleRef.current;
    if (handle && capturedPointerIdRef.current !== null) {
      handle.releasePointerCapture(capturedPointerIdRef.current);
    }
    capturedPointerIdRef.current = null;
    setIsResizing(false);
    // Persist the final height
    if (scrollContainerRef.current) {
      const finalHeight = scrollContainerRef.current.offsetHeight;
      updateSetting('stashMaxHeight', finalHeight);
    }
    resizeStartRef.current = null;
  }, [isResizing, resizeHandleRef, scrollContainerRef, updateSetting]);

  const handleResizeDoubleClick = useCallback((): void => {
    updateSetting('stashMaxHeight', null);
    // Also reset inline style if it was set during resize
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.maxHeight = '';
    }
  }, [scrollContainerRef, updateSetting]);

  return {
    isResizing,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    handleResizeDoubleClick,
  };
}
