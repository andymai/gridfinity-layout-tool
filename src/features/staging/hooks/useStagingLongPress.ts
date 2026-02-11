import { useRef, useCallback, useEffect } from 'react';
import type { BinId } from '@/core/types';

/** Long-press duration for context menu on touch devices (ms) */
const LONG_PRESS_DURATION = 500;
/** Movement threshold to cancel long-press (px) */
const MOVEMENT_THRESHOLD = 10;

interface UseStagingLongPressOptions {
  isTouchDevice: boolean;
  showContextMenu: (
    binIds: BinId[],
    position: { x: number; y: number },
    source?: 'grid' | 'staging'
  ) => void;
}

interface UseStagingLongPressReturn {
  /** Whether a long-press was triggered (prevents click/drag from firing) */
  longPressTriggeredRef: React.RefObject<boolean>;
  /** Call on pointerDown to start long-press timer */
  startLongPress: (binId: BinId, clientX: number, clientY: number) => void;
  /** Call on pointerMove to cancel if moved too far */
  handlePointerMove: (clientX: number, clientY: number) => void;
  /** Call on pointerUp/pointerCancel to cleanup */
  handlePointerEnd: () => void;
}

export function useStagingLongPress({
  isTouchDevice,
  showContextMenu,
}: UseStagingLongPressOptions): UseStagingLongPressReturn {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (binId: BinId, clientX: number, clientY: number) => {
      longPressTriggeredRef.current = false;
      pointerStartRef.current = { x: clientX, y: clientY };

      if (isTouchDevice) {
        clearLongPress();
        longPressTimerRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true;
          // Vibrate if supported (haptic feedback)
          if (typeof navigator.vibrate === 'function') {
            navigator.vibrate(50);
          }
          showContextMenu([binId], { x: clientX, y: clientY }, 'staging');
        }, LONG_PRESS_DURATION);
      }
    },
    [isTouchDevice, clearLongPress, showContextMenu]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (pointerStartRef.current) {
        const dx = clientX - pointerStartRef.current.x;
        const dy = clientY - pointerStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > MOVEMENT_THRESHOLD) {
          clearLongPress();
        }
      }
    },
    [clearLongPress]
  );

  const handlePointerEnd = useCallback(() => {
    clearLongPress();
    pointerStartRef.current = null;
  }, [clearLongPress]);

  // Clear timer on unmount to prevent stray callbacks after component removal
  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  return {
    longPressTriggeredRef,
    startLongPress,
    handlePointerMove,
    handlePointerEnd,
  };
}
