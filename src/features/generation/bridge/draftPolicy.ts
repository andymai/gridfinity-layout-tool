/**
 * Draft-skip policy shared by the bin-designer and baseplate preview hooks.
 *
 * The Manifold draft is only worth showing when the exact build will keep the
 * user waiting; the threshold depends on edit cadence (see the constants in
 * `./types`). This module owns the cadence tracking so both hooks apply the
 * same policy.
 */

import { FAST_EXACT_SKIP_MS, EDIT_BURST_WINDOW_MS, BURST_EXACT_SKIP_MS } from './types';

/**
 * Create a per-surface gate that returns the draft-skip threshold (ms) for the
 * edit happening now. Edits in rapid succession are a scrub (slider drag,
 * stepper burst, key hold): the debounced exact won't land until the burst
 * settles, so the bar drops — draft unless the exact is genuinely
 * realtime-fast, otherwise the preview is dead for the whole scrub.
 */
export function createDraftSkipGate(): () => number {
  let lastEditAt = 0;
  return () => {
    const now = performance.now();
    const scrubbing = now - lastEditAt < EDIT_BURST_WINDOW_MS;
    lastEditAt = now;
    return scrubbing ? BURST_EXACT_SKIP_MS : FAST_EXACT_SKIP_MS;
  };
}
