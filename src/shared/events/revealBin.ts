import type { BinId } from '@/core/types';

type RevealListener = (binId: BinId) => void;

/** A surface that can show a bin. A waiting reveal reaches each one once. */
export type RevealSurface = 'grid' | 'stash';

const listeners = new Set<{ readonly surface: RevealSurface; readonly listener: RevealListener }>();

/**
 * How long a reveal waits for a surface to mount. Opening a layout with an edit
 * share loads the collaboration code before the grid and the stash render.
 */
const PENDING_REVEAL_MS = 10_000;

/**
 * A reveal that reached no surface, for the surfaces that mount after it. Each
 * surface takes it once, so a surface that remounts does not replay it.
 */
let pending: {
  readonly binId: BinId;
  readonly at: number;
  readonly delivered: Set<RevealSurface>;
} | null = null;

/**
 * Asks whichever surface shows the bin, the grid or the stash, to bring it into
 * view. Explicit rather than derived from the selection, so choosing the same
 * bin again reveals it again.
 */
export function revealBin(binId: BinId): void {
  pending = listeners.size === 0 ? { binId, at: Date.now(), delivered: new Set() } : null;
  for (const { listener } of listeners) listener(binId);
}

export function onRevealBin(surface: RevealSurface, listener: RevealListener): () => void {
  const entry = { surface, listener };
  listeners.add(entry);
  // Each surface checks whether the bin is its own, so both get the reveal.
  if (
    pending !== null &&
    !pending.delivered.has(surface) &&
    Date.now() - pending.at <= PENDING_REVEAL_MS
  ) {
    pending.delivered.add(surface);
    listener(pending.binId);
  }
  return () => {
    listeners.delete(entry);
  };
}

export function __resetRevealForTests(): void {
  listeners.clear();
  pending = null;
}
