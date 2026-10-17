import { useEffect } from 'react';
import { onRevealBin } from '@/shared/events/revealBin';

/**
 * A zoomed-in grid scrolls, so a revealed bin can sit outside its viewport.
 * Focusing it also gives keyboard navigation its start, through the bin's
 * own focus handler.
 */
export function useRevealGridBin(): void {
  useEffect(
    () =>
      onRevealBin((binId) => {
        requestAnimationFrame(() => {
          const element = document.querySelector(`[data-bin-id="${CSS.escape(binId)}"]`);
          if (!(element instanceof HTMLElement)) return;
          element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          element.focus({ preventScroll: true });
        });
      }),
    []
  );
}
