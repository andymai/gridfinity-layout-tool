/**
 * Worker message protocol types — barrel.
 *
 * Re-exports the request messages (`./messages`), the response messages and
 * their payloads (`./responses`), and the shared mesh data shapes
 * (`./meshData`). Importers keep using `@/features/generation/bridge/types`.
 */

export * from './messages';
export * from './responses';
export * from './meshData';

/**
 * Skip the Manifold draft when the exact build is expected to finish faster
 * than this (ms, predicted from the previous exact generation). A draft that's
 * replaced within ~a second reads as flicker — two visual jumps for no real
 * feedback win — so fast generations (small/cache-warm) go straight to exact.
 * No history yet (cold start) counts as slow.
 */
export const FAST_EXACT_SKIP_MS = 1000;

/**
 * Edits arriving closer together than this are a scrub (slider drag, stepper
 * burst, key hold). The exact is debounced and won't land until the burst
 * settles, so the draft-vs-exact comparison changes: without a draft the
 * preview is dead for the whole scrub.
 */
export const EDIT_BURST_WINDOW_MS = 350;

/**
 * Draft-skip threshold while scrubbing — only skip the draft when the exact
 * is genuinely realtime-fast (can keep up with the edit rate); otherwise keep
 * drafting for continuous feedback.
 */
export const BURST_EXACT_SKIP_MS = 300;

/**
 * Fire the exact generation immediately (skip the adaptive debounce) when its
 * cache-aware estimate predicts a cost below this, the worker is idle (estimate
 * is non-null), and the edit is not part of a scrub. A wasted immediate exact
 * then costs at most this long and cannot wedge the single-threaded worker,
 * whereas a heavier exact fired early could be superseded mid-op by the next
 * edit and — since a long boolean/pattern_cut can't be cancelled — block the
 * worker until it finishes. Above this bound the adaptive debounce stays in
 * charge (it coalesces scrubs and the Manifold draft masks its latency).
 */
export const EXACT_IMMEDIATE_MAX_MS = 600;

/**
 * Once an exact generation has taken at least this long, force the Manifold
 * draft on the next edits regardless of the cache-aware estimate. A heavy
 * design's estimate can under-predict (it keys off cache state that a dimension
 * edit invalidates), and a wrongly-skipped draft leaves a multi-second exact
 * with no interim feedback at all. The last exact's own duration is the most
 * reliable signal that this design is one where the draft earns its flicker.
 */
export const FORCE_DRAFT_AFTER_EXACT_MS = 1000;
