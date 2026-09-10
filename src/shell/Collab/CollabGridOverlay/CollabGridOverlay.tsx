import { Suspense } from 'react';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';

// Collab overlays pull the Liveblocks client; collaboration is opt-in, so they
// load only when a session is active instead of in the eager Grid bundle.
const CollabCursors = lazyWithRetry(() =>
  import('../CollabCursors').then(namedExport('CollabCursors'))
);
const CollabGhosts = lazyWithRetry(() =>
  import('../CollabGhosts').then(namedExport('CollabGhosts'))
);
const CollabSelectionRings = lazyWithRetry(() =>
  import('../CollabSelectionRings').then(namedExport('CollabSelectionRings'))
);

/** The grid-space collaboration overlays, handed to `Grid` through its `collabOverlay` slot. */
export function CollabGridOverlay() {
  return (
    <Suspense fallback={null}>
      <CollabSelectionRings />
      <CollabGhosts />
      <CollabCursors />
    </Suspense>
  );
}
