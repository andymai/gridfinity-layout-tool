import { useEffect } from 'react';
import { onRevealBin } from '@/shared/events/revealBin';

/** A zoomed-in grid scrolls, so a revealed bin can sit outside its viewport. */
export function useRevealGridBin(): void {
  useEffect(
    () =>
      onRevealBin((binId) => {
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-bin-id="${CSS.escape(binId)}"]`)
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
      }),
    []
  );
}
