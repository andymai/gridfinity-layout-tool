import { useEffect, useCallback, useState } from 'react';
import { useUIStore, useLayoutStore, useUndoableAction } from '../store';
import { canPlaceBin } from '../utils/validation';
import { STAGING_ID } from '../constants';

/**
 * Hook for keyboard-based bin dragging.
 * Press M to enter move mode, arrow keys to adjust position, Enter to confirm, Escape to cancel.
 *
 * Usage:
 * - Select a bin (or focus a bin and press Space to select)
 * - Press M to enter move mode
 * - Use arrow keys to preview new position
 * - Press Enter to apply move, or Escape to cancel
 */
export function useKeyboardDrag() {
  const keyboardDragMode = useUIStore(state => state.keyboardDragMode);
  const setKeyboardDragMode = useUIStore(state => state.setKeyboardDragMode);
  const selectedBinIds = useUIStore(state => state.selectedBinIds);
  const announceToScreenReader = useUIStore(state => state.announceToScreenReader);
  const setInteraction = useUIStore(state => state.setInteraction);

  const layout = useLayoutStore(state => state.layout);
  const updateBin = useLayoutStore(state => state.updateBin);

  const { execute } = useUndoableAction();

  // Track the drag offset (cumulative movement)
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  /**
   * Enter drag mode for selected bins.
   */
  const enterDragMode = useCallback(() => {
    if (selectedBinIds.length === 0) {
      announceToScreenReader('No bins selected. Select a bin first.');
      return;
    }

    // Check if any selected bins are in staging
    const hasStaging = selectedBinIds.some(id => {
      const bin = layout.bins.find(b => b.id === id);
      return bin?.layerId === STAGING_ID;
    });

    if (hasStaging) {
      announceToScreenReader('Cannot move bins in staging area. Place them on the grid first.');
      return;
    }

    setKeyboardDragMode(true);
    setDragOffset({ dx: 0, dy: 0 });

    const count = selectedBinIds.length;
    announceToScreenReader(
      `Move mode: ${count} ${count === 1 ? 'bin' : 'bins'} selected. ` +
      `Use arrow keys to move, Enter to place, Escape to cancel.`
    );

    // Set interaction to show ghost preview
    setInteraction({
      type: 'drag',
      binIds: selectedBinIds,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    });
  }, [selectedBinIds, layout.bins, setKeyboardDragMode, announceToScreenReader, setInteraction]);

  /**
   * Adjust drag offset (called by arrow keys).
   */
  const adjustDragOffset = useCallback((dx: number, dy: number) => {
    if (!keyboardDragMode) return;

    setDragOffset(prev => {
      const newOffset = { dx: prev.dx + dx, dy: prev.dy + dy };

      // Update interaction to show preview with new offset
      setInteraction({
        type: 'drag',
        binIds: selectedBinIds,
        startX: 0,
        startY: 0,
        offsetX: newOffset.dx,
        offsetY: newOffset.dy,
      });

      // Announce position change
      const direction = dx !== 0
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'up' : 'down');
      announceToScreenReader(`Moved ${direction}`);

      return newOffset;
    });
  }, [keyboardDragMode, selectedBinIds, setInteraction, announceToScreenReader]);

  /**
   * Confirm drag - apply the movement to all selected bins.
   */
  const confirmDrag = useCallback(() => {
    if (!keyboardDragMode) return;

    const { dx, dy } = dragOffset;

    // If no movement, just exit
    if (dx === 0 && dy === 0) {
      announceToScreenReader('No movement. Exiting move mode.');
      setKeyboardDragMode(false);
      setInteraction(null);
      setDragOffset({ dx: 0, dy: 0 });
      return;
    }

    // Validate all bins can move to new positions
    const excludeIds = new Set(selectedBinIds);
    let allValid = true;
    const validationErrors: string[] = [];

    for (const binId of selectedBinIds) {
      const bin = layout.bins.find(b => b.id === binId);
      if (!bin || bin.layerId === STAGING_ID) {
        allValid = false;
        break;
      }

      const newX = bin.x + dx;
      const newY = bin.y + dy;

      const result = canPlaceBin(
        { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
        bin.layerId,
        layout,
        binId,
        excludeIds
      );

      if (!result.valid) {
        allValid = false;
        if (result.reason) {
          validationErrors.push(result.reason);
        }
        break;
      }
    }

    if (!allValid) {
      const reason = validationErrors[0] || 'Invalid position';
      announceToScreenReader(`Cannot place bins: ${reason}`);
      return;
    }

    // Apply the movement
    execute(() => {
      for (const binId of selectedBinIds) {
        const bin = layout.bins.find(b => b.id === binId);
        if (!bin) continue;
        updateBin(binId, { x: bin.x + dx, y: bin.y + dy });
      }
    });

    announceToScreenReader(`Moved ${selectedBinIds.length} ${selectedBinIds.length === 1 ? 'bin' : 'bins'}.`);

    // Exit drag mode
    setKeyboardDragMode(false);
    setInteraction(null);
    setDragOffset({ dx: 0, dy: 0 });
  }, [keyboardDragMode, dragOffset, selectedBinIds, layout, updateBin, execute, setKeyboardDragMode, setInteraction, announceToScreenReader]);

  /**
   * Exit drag mode without applying changes.
   */
  const exitDragMode = useCallback(() => {
    if (!keyboardDragMode) return;

    announceToScreenReader('Move cancelled.');
    setKeyboardDragMode(false);
    setInteraction(null);
    setDragOffset({ dx: 0, dy: 0 });
  }, [keyboardDragMode, setKeyboardDragMode, setInteraction, announceToScreenReader]);

  /**
   * Handle keyboard events for drag mode.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!keyboardDragMode) return;

    // Ignore if in input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Arrow keys - adjust position
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustDragOffset(0, 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustDragOffset(0, -1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      adjustDragOffset(-1, 0);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      adjustDragOffset(1, 0);
      return;
    }

    // Enter - confirm
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmDrag();
      return;
    }

    // Escape - cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      exitDragMode();
      return;
    }
  }, [keyboardDragMode, adjustDragOffset, confirmDrag, exitDragMode]);

  // Register keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    keyboardDragMode,
    enterDragMode,
    adjustDragOffset,
    confirmDrag,
    exitDragMode,
  };
}
