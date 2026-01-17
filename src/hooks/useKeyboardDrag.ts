import { useEffect, useCallback, useState } from 'react';
import { useUIStore, useLayoutStore, useUndoableAction } from '../core/store';
import { useMutations } from '../shared/contexts';
import { canPlaceBin } from '../utils/validation';
import { constrainGroupDelta } from '../utils/selection';
import { findBinById } from '../utils/entity';
import type { Bin } from '../core/types';
import { STAGING_ID, hasFractionalDimensions } from '../core/constants';

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
  const { updateBin } = useMutations();

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

    const hasStaging = selectedBinIds.some(id => {
      const bin = findBinById(layout, id);
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

    const firstBin = findBinById(layout, selectedBinIds[0]);
    const startCoord = firstBin ? { x: firstBin.x, y: firstBin.y } : { x: 0, y: 0 };
    setInteraction({
      type: 'drag',
      binIds: selectedBinIds,
      startCoord,
      currentCoord: { x: 0, y: 0 }, // Delta starts at zero (no movement yet)
      valid: true,
      isOverGrid: true,
    });
  }, [selectedBinIds, layout, setKeyboardDragMode, announceToScreenReader, setInteraction]);

  /**
   * Adjust drag offset (called by arrow keys).
   */
  const adjustDragOffset = useCallback((dx: number, dy: number) => {
    if (!keyboardDragMode) return;

    setDragOffset(prev => {
      const selectedBins = selectedBinIds
        .map(id => findBinById(layout, id))
        .filter((b): b is Bin => b !== undefined && b.layerId !== STAGING_ID);

      if (selectedBins.length === 0) return prev;

      // Calculate new raw offset
      const rawDeltaX = prev.dx + dx;
      const rawDeltaY = prev.dy + dy;

      // Constrain delta to keep entire group in bounds (preserves arrangement)
      const { deltaX, deltaY } = constrainGroupDelta(
        selectedBins,
        rawDeltaX,
        rawDeltaY,
        layout.drawer
      );

      // If constrained delta equals previous, the group can't move further
      if (deltaX === prev.dx && deltaY === prev.dy) {
        announceToScreenReader('Cannot move further in this direction');
        return prev;
      }

      const newOffset = { dx: deltaX, dy: deltaY };

      // Validate all bins at their new positions
      const excludeIds = new Set(selectedBinIds);
      let allValid = true;
      for (const bin of selectedBins) {
        const result = canPlaceBin(
          { x: bin.x + deltaX, y: bin.y + deltaY, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout,
          bin.id,
          excludeIds
        );
        if (!result.valid) {
          allValid = false;
          break;
        }
      }

      const firstBin = selectedBins[0];
      const startCoord = { x: firstBin.x, y: firstBin.y };
      setInteraction({
        type: 'drag',
        binIds: selectedBinIds,
        startCoord,
        currentCoord: { x: deltaX, y: deltaY },
        valid: allValid,
        isOverGrid: true,
      });

      // Announce position change
      const direction = dx !== 0
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'up' : 'down');
      announceToScreenReader(`Moved ${direction}`);

      return newOffset;
    });
  }, [keyboardDragMode, selectedBinIds, layout, setInteraction, announceToScreenReader]);

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

    const excludeIds = new Set(selectedBinIds);
    let allValid = true;
    const validationErrors: string[] = [];

    for (const binId of selectedBinIds) {
      const bin = findBinById(layout, binId);
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

    execute(() => {
      for (const binId of selectedBinIds) {
        const bin = findBinById(layout, binId);
        if (!bin) continue;
        updateBin(binId, { x: bin.x + dx, y: bin.y + dy });
      }
    });

    announceToScreenReader(`Moved ${selectedBinIds.length} ${selectedBinIds.length === 1 ? 'bin' : 'bins'}.`);

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

    // Arrow keys - adjust position (0.5 if any selected bin has fractional dimensions)
    const selectedBins = selectedBinIds
      .map(id => findBinById(layout, id))
      .filter((b): b is Bin => b !== undefined);
    const hasHalfBins = selectedBins.some(bin => hasFractionalDimensions(bin));
    const increment = hasHalfBins ? 0.5 : 1;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustDragOffset(0, increment);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustDragOffset(0, -increment);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      adjustDragOffset(-increment, 0);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      adjustDragOffset(increment, 0);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      confirmDrag();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      exitDragMode();
      return;
    }
  }, [keyboardDragMode, adjustDragOffset, confirmDrag, exitDragMode, selectedBinIds, layout]);

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
