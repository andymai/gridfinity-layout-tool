// Import the leaf module directly, not the `@/shared/webgl` barrel: the barrel
// re-exports WebGLFallback, which imports this analytics package back — a cycle.
import { detectWebGL } from '@/shared/webgl/detectWebGL';

/**
 * Browser-extension and platform noise we don't want in PostHog.
 *
 * Extensions (ad blockers, password managers, dev tools, etc.) inject scripts
 * into the page context. When those scripts throw, our `window.onerror` /
 * `unhandledrejection` listeners catch them and PostHog's `capture_exceptions`
 * also auto-captures them — surfacing as errors whose only stack frame points
 * at `init.ts`, looking like our bug. They're not.
 */

/**
 * Substring of the error three.js throws when it can't acquire a GL context.
 * The same message is thrown from every canvas mount site (designer, baseplate)
 * with a different stack, so without a pinned fingerprint PostHog splits it into
 * a separate issue per site. Keep in sync with `WEBGL_CONTEXT_ERROR` in
 * `WebGLErrorBoundary.tsx`.
 */
const WEBGL_CONTEXT_ERROR = 'Error creating WebGL context';

/** Stable fingerprint that collapses every WebGL-context-creation variant into one issue. */
const WEBGL_CONTEXT_FINGERPRINT = 'webgl-context-creation-failed';

const IGNORED_MESSAGE_PATTERNS: readonly RegExp[] = [
  // Safari Web Extensions message bus
  /No Listener: tabs:/i,
  // Chrome extension API surfaces
  /Invalid call to runtime\.sendMessage/i,
  /Extension context invalidated/i,
  // Generic same-origin script error from a script we didn't load
  /^Script error\.?$/,
  // Extension content-script DOM observers (very common, never actionable)
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
];

const IGNORED_SOURCE_PATTERNS: readonly RegExp[] = [
  /^(chrome|moz|safari-web|safari)-extension:\/\//,
];

export function shouldIgnoreError(
  message: string | null | undefined,
  source?: string | null
): boolean {
  if (message) {
    for (const pattern of IGNORED_MESSAGE_PATTERNS) {
      if (pattern.test(message)) return true;
    }
  }
  if (source) {
    for (const pattern of IGNORED_SOURCE_PATTERNS) {
      if (pattern.test(source)) return true;
    }
  }
  return false;
}

interface ExceptionEventLike {
  event?: string;
  properties?: {
    $exception_list?: Array<{ value?: string }>;
    $exception_values?: string[];
    $exception_fingerprint?: string;
  };
}

/**
 * PostHog `before_send` hook. Drops `$exception` events whose **primary**
 * exception matches the extension/noise filters, dedupes the WebGL
 * context-creation burst, and passes everything else through unchanged.
 *
 * Only the first entry in `$exception_list` / `$exception_values` is
 * checked. Subsequent entries are `Error.cause` chains — if a real app
 * error wrapped extension noise as a cause, we want to keep the event.
 *
 * WebGL context-creation failures get two treatments here:
 *  - A pinned `$exception_fingerprint` so the same message thrown from
 *    different canvas mount sites (each with its own stack) groups into one
 *    issue instead of fragmenting per-site.
 *  - Capture-once-per-session: once `WebGLErrorBoundary` has caught the failure
 *    and flipped detection to unavailable (`markWebGLUnavailable`), the canvas
 *    won't re-mount and the fallback is already showing — so every later throw
 *    in the burst is pure noise. Gate on that same flag and drop them.
 *
 * Typed loosely (input ExceptionEventLike | null, returning same shape) so
 * posthog-js's BeforeSendFn signature accepts it — it passes CaptureResult,
 * which structurally satisfies ExceptionEventLike for the fields we read.
 */
export function filterExceptionForPosthog(
  event: ExceptionEventLike | null
): ExceptionEventLike | null {
  if (!event) return event;
  if (event.event !== '$exception') return event;
  const primary =
    event.properties?.$exception_list?.[0]?.value ?? event.properties?.$exception_values?.[0];
  if (shouldIgnoreError(primary)) return null;

  if (primary?.includes(WEBGL_CONTEXT_ERROR)) {
    // Detection already unavailable → the boundary handled this and we've
    // captured (or intentionally dropped) the first one; mute the rest.
    if (!detectWebGL().available) return null;
    event.properties = {
      ...event.properties,
      $exception_fingerprint: WEBGL_CONTEXT_FINGERPRINT,
    };
  }

  return event;
}
