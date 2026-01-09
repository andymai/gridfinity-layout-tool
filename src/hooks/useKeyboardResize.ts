import { useEffect, useCallback, useState } from 'react';
import { useUIStore, useLayoutStore, useUndoableAction } from '../store';
import { canPlaceBin } from '../utils/validation';
import { CONSTRAINTS, STAGING_ID } from '../constants';

/**
 * Hook for keyboard-based bin resizing.
 * Press R to enter resize mode, arrow keys to adjust size, Enter to confirm, Escape to cancel.
 *
 * Usage:
 * - Select a single bin (resize only works on single selection)
 * - Press R to enter resize mode
 * - Use arrow keys to preview new size (Left/Right = width, Up/Down = depth)
 * - Press Enter to apply resize, or Escape to cancel
 */
export function useKeyboardResize() {
  const keyboardResizeMode = useUIStore(state => state.keyboardResizeMode);
  const setKeyboardResizeMode = useUIStore(state => state.setKeyboardResizeMode);
  const selectedBinIds = useUIStore(state => state.selectedBinIds);
  const announceToScreenReader = useUIStore(state => state.announceToScreenReader);
  const setInteraction = useUIStore(state => state.setInteraction);

  const layout = useLayoutStore(state => state.layout);
  const updateBin = useLayoutStore(state => state.updateBin);

  const { execute } = useUndoableAction();

  // Track the resize delta (cumulative size change)
  const [resizeDelta, setResizeDelta] = useState({ dw: 0, dd: 0 });

  /**
   * Enter resize mode for selected bin.
   */
  const enterResizeMode = useCallback(() => {
    if (selectedBinIds.length === 0) {
      announceToScreenReader('No bins selected. Select a bin first.');
      return;
    }

    if (selectedBinIds.length > 1) {
      announceToScreenReader('Resize mode only works with a single bin. Select one bin.');
      return;
    }

    const bin = layout.bins.find(b => b.id === selectedBinIds[0]);
    if (!bin) return;

    if (bin.layerId === STAGING_ID) {
      announceToScreenReader('Cannot resize bins in staging area. Place them on the grid first.');
      return;
    }

    setKeyboardResizeMode(true);
    setResizeDelta({ dw: 0, dd: 0 });

    announceToScreenReader(
      `Resize mode: Current size ${bin.width} by ${bin.depth}. ` +
      `Use Left/Right arrows for width, Up/Down arrows for depth. ` +
      `Enter to apply, Escape to cancel.`
    );

    // Set interaction to show resize preview
    setInteraction({
      type: 'resize',
      binId: bin.id,
      handle: 'se', // Use southeast handle for preview
      startX: 0,
      startY: 0,
      originalBin: bin,
    });
  }, [selectedBinIds, layout.bins, setKeyboardResizeMode, announceToScreenReader, setInteraction]);

  /**
   * Adjust resize delta (called by arrow keys).
   */
  const adjustResizeDelta = useCallback((dw: number, dd: number) => {
    if (!keyboardResizeMode || selectedBinIds.length !== 1) return;

    const bin = layout.bins.find(b => b.id === selectedBinIds[0]);
    if (!bin) return;

    setResizeDelta(prev => {
      const newDelta = { dw: prev.dw + dw, dd: prev.dd + dd };
      const newWidth = Math.max(1, Math.min(CONSTRAINTS.BIN_WIDTH_MAX, bin.width + newDelta.dw));
      const newDepth = Math.max(1, Math.min(CONSTRAINTS.BIN_DEPTH_MAX, bin.depth + newDelta.dd));

      // Update interaction to show preview with new size
      setInteraction({
        type: 'resize',
        binId: bin.id,
        handle: 'se',
        startX: 0,
        startY: 0,
        originalBin: bin,
        previewWidth: newWidth,
        previewDepth: newDepth,
      });

      // Announce size change
      announceToScreenReader(`Size: ${newWidth} by ${newDepth}`);

      return newDelta;
    });
  }, [keyboardResizeMode, selectedBinIds, layout.bins, setInteraction, announceToScreenReader]);

  /**
   * Confirm resize - apply the size change to the bin.
   */
  const confirmResize = useCallback(() => {
    if (!keyboardResizeMode || selectedBinIds.length !== 1) return;

    const { dw, dd } = resizeDelta;
    const bin = layout.bins.find(b => b.id === selectedBinIds[0]);
    if (!bin) return;

    const newWidth = Math.max(1, Math.min(CONSTRAINTS.BIN_WIDTH_MAX, bin.width + dw));
    const newDepth = Math.max(1, Math.min(CONSTRAINTS.BIN_DEPTH_MAX, bin.depth + dd));

    // If no size change, just exit
    if (newWidth === bin.width && newDepth === bin.depth) {
      announceToScreenReader('No size change. Exiting resize mode.');
      setKeyboardResizeMode(false);
      setInteraction(null);
      setResizeDelta({ dw: 0, dd: 0 });
      return;
    }

    // Validate new size fits
    const result = canPlaceBin(
      { x: bin.x, y: bin.y, width: newWidth, depth: newDepth, height: bin.height },
      bin.layerId,
      layout,
      bin.id
    );

    if (!result.valid) {
      announceToScreenReader(`Cannot resize: ${result.reason || 'Invalid size'}`);
      return;
    }

    // Apply the resize
    execute(() => {
      updateBin(bin.id, { width: newWidth, depth: newDepth });
    });

    announceToScreenReader(`Resized to ${newWidth} by ${newDepth}.`);

    // Exit resize mode
    setKeyboardResizeMode(false);
    setInteraction(null);
    setResizeDelta({ dw: 0, dd: 0 });
  }, [keyboardResizeMode, resizeDelta, selectedBinIds, layout, updateBin, execute, setKeyboardResizeMode, setInteraction, announceToScreenReader]);

  /**
   * Exit resize mode without applying changes.
   */
  const exitResizeMode = useCallback(() => {
    if (!keyboardResizeMode) return;

    announceToScreenReader('Resize cancelled.');
    setKeyboardResizeMode(false);
    setInteraction(null);
    setResizeDelta({ dw: 0, dd: 0 });
  }, [keyboardResizeMode, setKeyboardResizeMode, setInteraction, announceToScreenReader]);

  /**
   * Handle keyboard events for resize mode.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!keyboardResizeMode) return;

    // Ignore if in input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Arrow keys - adjust size
    // Left/Right: width, Up/Down: depth
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      adjustResizeDelta(-1, 0);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      adjustResizeDelta(1, 0);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustResizeDelta(0, 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustResizeDelta(0, -1);
      return;
    }

    // Enter - confirm
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmResize();
      return;
    }

    // Escape - cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      exitResizeMode();
      return;
    }
  }, [keyboardResizeMode, adjustResizeDelta, confirmResize, exitResizeMode]);

  // Register keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    keyboardResizeMode,
    enterResizeMode,
    adjustResizeDelta,
    confirmResize,
    exitResizeMode,
  };
}
