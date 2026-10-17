import type { BinId } from '@/core/types';

type RevealListener = (binId: BinId) => void;

const listeners = new Set<RevealListener>();

/**
 * Asks whichever surface shows the bin, the grid or the stash, to bring it into
 * view. Explicit rather than derived from the selection, so choosing the same
 * bin again reveals it again.
 */
export function revealBin(binId: BinId): void {
  for (const listener of listeners) listener(binId);
}

export function onRevealBin(listener: RevealListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
