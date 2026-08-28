import { configureTextBuilder } from 'troika-three-text';

/**
 * Some WebKit builds fail to `eval` the stringified module troika-three-text
 * hands to its SDF-glyph worker, so every `<Text>` sync throws "Worker module
 * function was called but `init` did not return a callable function" instead
 * of laying out text (tracked as the `troika-worker-init-failed` PostHog
 * fingerprint in errorFilters.ts — WebKit only, every version, growing).
 * Forcing the main-thread code path sidesteps that eval entirely; it's still
 * asynchronous, so this doesn't block a frame.
 */
configureTextBuilder({ useWorker: false });
