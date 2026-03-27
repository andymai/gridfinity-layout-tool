import type { PointerEvent } from 'react';
import { useRef, useCallback } from 'react';
import type { BinId, ResizeHandle } from '@/core/types';
import { useViewStore, useInteractionStore, useMobileStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';

const LONG_PRESS_DURATION = 500; // ms
const DOUBLE_TAP_THRESHOLD = 300; // ms

export interface BinPointerInteractionInput {
  binId: BinId;
  isGhost: boolean;
  isSelected: boolean;
  onStartDrag: (
    binId: BinId,
    clientX: number,
    clientY: number,
    pointerId?: number,
    duplicate?: boolean,
    swapMode?: boolean
  ) => void;
  onStartResize: (binId: BinId, handle: ResizeHandle, pointerId?: number) => void;
  setSelectedBin: (binId: BinId) => void;
  toggleSelection: (binId: BinId) => void;
  showQuickLabel: (binId: BinId) => void;
}

export interface BinPointerInteractionResult {
  handlePointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  handlePointerCancel: () => void;
  handleContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleResizePointerDown: (e: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => void;
  handleDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Hook that encapsulates all pointer event handling for a bin:
 * long-press, double-tap, drag initiation, resize, context menu.
 */
export function useBinPointerInteraction(
  input: BinPointerInteractionInput
): BinPointerInteractionResult {
  const {
    binId,
    isGhost,
    isSelected,
    onStartDrag,
    onStartResize,
    setSelectedBin,
    toggleSelection,
    showQuickLabel,
  } = input;

  const t = useTranslation();
  const { isTouchDevice } = useResponsive();

  const showContextMenu = useViewStore((state) => state.showContextMenu);
  const paintSize = useInteractionStore((state) => state.paintSize);
  const setPaintSize = useInteractionStore((state) => state.setPaintSize);
  const setActiveMobilePanel = useMobileStore((state) => state.setActiveMobilePanel);
  const addToast = useToastStore((state) => state.addToast);

  // Long-press detection for mobile context menu
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  // Double-tap detection for mobile
  const lastTapTimeRef = useRef(0);
  // Track pointer ID for passing to useInteraction
  const activePointerIdRef = useRef<number | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isGhost) return;
    // Ignore non-primary pointer (second finger) - allow two-finger pan
    if (!e.isPrimary) return;

    // Defense-in-depth: if the event originated from a resize handle, bail out.
    const target = e.target as HTMLElement;
    if (target.closest('.resize-handle')) return;

    e.preventDefault();
    e.stopPropagation();

    // Store pointer ID for passing to useInteraction when drag starts
    activePointerIdRef.current = e.pointerId;

    // Reset long-press state
    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    // Start long-press timer on touch devices
    if (isTouchDevice && e.button === 0) {
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        // Vibrate if supported (haptic feedback)
        if (typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
        // Show context menu
        showContextMenu([binId], { x: e.clientX, y: e.clientY }, 'grid');
      }, LONG_PRESS_DURATION);
    }

    if (e.button === 0) {
      const isMultiSelectKey = e.ctrlKey || e.metaKey;

      // Exit paint mode when selecting a bin
      if (paintSize) {
        setPaintSize(null);
      }

      if (isMultiSelectKey) {
        // Ctrl/Cmd+click: toggle this bin in selection
        toggleSelection(binId);
        clearLongPress();
      } else if (!isTouchDevice) {
        // Desktop: Normal click - single select and start drag immediately
        // Alt+drag starts a duplicate operation
        // Shift+drag starts swap mode (swap with compatible bin)
        const isDuplicateDrag = e.altKey && !e.shiftKey;
        const isSwapDrag = e.shiftKey && !e.altKey;
        if (!isSelected) {
          setSelectedBin(binId);
          // Show first-time hint about resize handles
          const { settings, updateSetting } = useSettingsStore.getState();
          if (!settings.dismissedHints.includes('bin-resize')) {
            addToast(t('toast.resizeTip'), 'info');
            updateSetting('dismissedHints', [...settings.dismissedHints, 'bin-resize']);
          }
        }
        onStartDrag(binId, e.clientX, e.clientY, e.pointerId, isDuplicateDrag, isSwapDrag);
      } else {
        // Touch: Select on pointer down, drag starts on move
        if (!isSelected) {
          setSelectedBin(binId);
        }
      }
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Cancel long-press if pointer moved too far (10px threshold)
    if (pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 10) {
        clearLongPress();
        // Start drag on move for touch devices (pass pointer ID for capture management)
        if (isTouchDevice && !longPressTriggeredRef.current) {
          onStartDrag(binId, e.clientX, e.clientY, activePointerIdRef.current ?? e.pointerId);
        }
      }
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    activePointerIdRef.current = null;

    // Double-tap detection for mobile - open inspector
    if (isTouchDevice && !longPressTriggeredRef.current && pointerStartRef.current) {
      // Check if pointer didn't move much (wasn't a drag)
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 10) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < DOUBLE_TAP_THRESHOLD) {
          // Double-tap detected - open inspector
          setActiveMobilePanel('inspector');
          lastTapTimeRef.current = 0; // Reset to prevent triple-tap
        } else {
          lastTapTimeRef.current = now;
        }
      }
    }

    pointerStartRef.current = null;
  };

  const handlePointerCancel = () => {
    clearLongPress();
    activePointerIdRef.current = null;
    pointerStartRef.current = null;
  };

  // Right-click context menu for desktop
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isGhost) return;
    e.preventDefault();
    e.stopPropagation();
    // Select the bin if not already selected
    if (!isSelected) {
      setSelectedBin(binId);
    }
    showContextMenu([binId], { x: e.clientX, y: e.clientY }, 'grid');
  };

  const handleResizePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => {
      // Ignore secondary touches (allow two-finger pan)
      if (!e.isPrimary) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 0) {
        // Haptic feedback on touch devices when starting resize
        if (isTouchDevice && typeof navigator.vibrate === 'function') {
          navigator.vibrate(30);
        }
        onStartResize(binId, handle, e.pointerId);
      }
    },
    [onStartResize, binId, isTouchDevice]
  );

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isGhost) return;
    e.preventDefault();
    e.stopPropagation();
    // Select the bin if not selected and show quick label popover
    if (!isSelected) {
      setSelectedBin(binId);
    }
    showQuickLabel(binId);
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleContextMenu,
    handleResizePointerDown,
    handleDoubleClick,
  };
}
