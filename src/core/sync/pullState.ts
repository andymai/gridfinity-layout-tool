import type { PullResult } from './poller';

/**
 * Pull bookkeeping kept apart from the poller so the session store can reset
 * it on sign-out without importing the poller, which reads the session store.
 */
export const pullState: {
  lastIndexUpdatedAt: number;
  inFlight: Promise<PullResult> | null;
  // Bumped by `resetPullState`. `run()` captures the value at call time;
  // if it changes before the run finishes, the run abandons its writes.
  // Prevents a pre-reset pull from re-installing the prior user's
  // `lastIndexUpdatedAt` after sign-out.
  generation: number;
} = { lastIndexUpdatedAt: 0, inFlight: null, generation: 0 };

// Reset on sign-out: without this the next user's first poll would send
// the prior user's `lastIndexUpdatedAt` as `If-Modified-Since`. Bumping
// `generation` also poisons any in-flight `run()` so its late completion
// can't re-install stale state.
export function resetPullState(): void {
  pullState.lastIndexUpdatedAt = 0;
  pullState.inFlight = null;
  pullState.generation++;
}
