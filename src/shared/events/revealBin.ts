import type { BinId } from '@/core/types';

type RevealListener = (binId: BinId) => void;

const listeners = new Set<RevealListener>();

/**
 * How long a reveal waits for a surface to mount. Opening a layout with an edit
 * share loads the collaboration code before the grid and the stash render.
 */
const PENDING_REVEAL_MS = 10_000;

/** A reveal that reached no surface, for the surfaces that mount after it. */
let pending: { readonly binId: BinId; readonly at: number } | null = null;

/**
 * Asks whichever surface shows the bin, the grid or the stash, to bring it into
 * view. Explicit rather than derived from the selection, so choosing the same
 * bin again reveals it again.
 */
export function revealBin(binId: BinId): void {
  pending = listeners.size === 0 ? { binId, at: Date.now() } : null;
  for (const listener of listeners) listener(binId);
}

export function onRevealBin(listener: RevealListener): () => void {
  listeners.add(listener);
  // Each surface checks whether the bin is its own, so both get the reveal.
  if (pending !== null && Date.now() - pending.at <= PENDING_REVEAL_MS) listener(pending.binId);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetRevealForTests(): void {
  listeners.clear();
  pending = null;
}
