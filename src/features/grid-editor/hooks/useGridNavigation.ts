import { useCallback, useEffect } from 'react';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useTranslation } from '@/i18n';
import { findNearestBinInDirection, type Direction } from '@/features/grid-editor/utils/navigation';

/**
 * Hook for keyboard-based spatial navigation between bins.
 * Handles arrow key navigation using hybrid alignment + distance scoring.
 *
 * Usage:
 * - Focus a bin (Tab to grid, click, or programmatic focus)
 * - Use arrow keys to navigate between bins
 * - Navigation respects current layer (only navigates within active layer)
 */
export function useGridNavigation() {
  const bins = useLayoutStore((state) => state.layout.bins);
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);
  const focusedBinId = useSelectionStore((state) => state.focusedBinId);
  const setFocusedBin = useSelectionStore((state) => state.setFocusedBin);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);
  const t = useTranslation();

  /**
   * Handle arrow key navigation.
   * Maps ArrowUp/Down/Left/Right to spatial navigation using findNearestBinInDirection.
   */
  const handleNavigationKey = useCallback(
    (key: string) => {
      if (!focusedBinId) return;

      const currentBin = bins.find((b) => b.id === focusedBinId);
      if (!currentBin) return;

      // Map key to direction
      let direction: Direction;
      switch (key) {
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
        default:
          return;
      }

      const nextBin = findNearestBinInDirection(currentBin, direction, bins, activeLayerId);
      if (nextBin) {
        setFocusedBin(nextBin.id);

        const label =
          nextBin.label ||
          t('grid.announce.binDimensions', { width: nextBin.width, depth: nextBin.depth });
        announceToScreenReader(
          t('grid.announce.movedTo', { label, col: nextBin.x + 1, row: nextBin.y + 1 })
        );
      }
    },
    [focusedBinId, bins, activeLayerId, setFocusedBin, announceToScreenReader, t]
  );

  /**
   * Synchronize DOM focus when focusedBinId changes.
   * This ensures the focused bin is actually focused in the DOM for accessibility.
   */
  useEffect(() => {
    if (!focusedBinId) return;

    // Find bin element by data attribute
    const binElement = document.querySelector(`[data-bin-id="${CSS.escape(focusedBinId)}"]`);
    if (binElement instanceof HTMLElement) {
      binElement.focus();
    }
  }, [focusedBinId]);

  return {
    handleNavigationKey,
  };
}
