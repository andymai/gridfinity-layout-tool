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

/**
 * A lazy route chunk that failed to import, in each engine's wording.
 *
 * Chrome and Firefox append the chunk URL, whose Vite hash rotates every build,
 * so message-based grouping mints a brand-new issue (and a new auto-filed bug)
 * per deploy for what is one recurring stale-bundle miss. Safari's variant
 * carries no URL and groups on its own; it belongs in the same bucket.
 *
 * Deliberately narrower than `isStaleAssetError`, which may answer for bare
 * `Load failed` / `Failed to fetch` because it is only ever asked about an error
 * that already failed to load the kernel. This runs against every exception, so
 * those phrasings would drag genuine API failures into the chunk bucket.
 */
const CHUNK_LOAD_ERROR =
  /(?:Failed to fetch|error loading) dynamically imported module|Importing a module script failed/;

/** Stable fingerprint collapsing every deploy's chunk-load miss into one issue. */
const CHUNK_LOAD_FINGERPRINT = 'chunk-load-failed';

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
  // Firefox-for-iOS injects a `__firefox__` global and Reader-mode content
  // script into the page; when that injected code throws (e.g. "Can't find
  // variable: __firefox__" or "window.__firefox__.reader" is undefined) our
  // handlers catch it. No app code is involved. Match every variant/fingerprint.
  /__firefox__/,
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

interface ExceptionLike {
  value?: string;
  stacktrace?: { frames?: Array<{ function?: string; filename?: string }> };
}

interface ExceptionEventLike {
  event?: string;
  properties?: {
    $exception_list?: ExceptionLike[];
    $exception_values?: string[];
    $exception_fingerprint?: string;
    [key: string]: unknown;
  };
}

/**
 * True when the throw came out of an injected extension script.
 *
 * The source check used to run on `ErrorEvent.filename` in a `window.onerror`
 * handler. posthog-js captures these natively too, and that path only ever sees
 * stack frames, so the frames are where the origin has to be read from now.
 */
function isExtensionSourced(exception: ExceptionLike): boolean {
  return (exception.stacktrace?.frames ?? []).some(
    (f) => f.filename !== undefined && shouldIgnoreError(undefined, f.filename)
  );
}

/**
 * `<Canvas>` kicks off an async `configure()` from a layout effect and neither
 * awaits it nor cancels it on teardown, so unmounting mid-configure leaves its
 * `onCreated` to run against a container ref React has already nulled:
 *
 *   onCreated: state => state.events.connect?.(… : divRef.current)
 *
 * `connect` then calls `addEventListener` on null. The canvas is already gone
 * by then, so nothing user-visible breaks and no app frame appears in the
 * stack — switching designs fast is enough to trigger it.
 *
 * Matched on the frame as well as the message: an app-side listener attached to
 * a null target throws the same words, and that one we want to hear about.
 */
const NULL_LISTENER_TARGET =
  /Cannot read propert(?:y|ies) of null \(reading '?addEventListener'?\)|null is not an object \(evaluating '[^']*\.addEventListener'\)/;

function isCanvasTeardownRace(exception: ExceptionLike): boolean {
  if (!exception.value || !NULL_LISTENER_TARGET.test(exception.value)) return false;
  // `connect` and `onCreated` are property names on object literals, so they
  // survive minification where the surrounding function names do not.
  return (exception.stacktrace?.frames ?? []).some((f) => f.function?.endsWith('connect') === true);
}

/**
 * PostHog `before_send` hook. Drops `$exception` events whose **primary**
 * exception matches the extension/noise filters or the R3F canvas teardown
 * race, dedupes the WebGL context-creation burst, pins chunk-load failures to
 * one fingerprint, and passes everything else through unchanged.
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
  const primaryException = event.properties?.$exception_list?.[0];
  const primary = primaryException?.value ?? event.properties?.$exception_values?.[0];
  if (shouldIgnoreError(primary)) return null;
  if (primaryException && isExtensionSourced(primaryException)) return null;
  if (primaryException && isCanvasTeardownRace(primaryException)) return null;

  if (primary?.includes(WEBGL_CONTEXT_ERROR)) {
    // Detection already unavailable → the boundary handled this and we've
    // captured (or intentionally dropped) the first one; mute the rest.
    if (!detectWebGL().available) return null;
    event.properties = {
      ...event.properties,
      $exception_fingerprint: WEBGL_CONTEXT_FINGERPRINT,
    };
  }

  if (primary !== undefined && CHUNK_LOAD_ERROR.test(primary)) {
    event.properties = {
      ...event.properties,
      $exception_fingerprint: CHUNK_LOAD_FINGERPRINT,
    };
  }

  return event;
}
