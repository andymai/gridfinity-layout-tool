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

/**
 * The generation worker's by-design reset rejections
 * (`GenerationBridge.ts`). Their stacks run through a hashed bridge chunk, so
 * message-based grouping mints a fresh issue (and a new auto-filed bug) every
 * time a deploy rotates that hash, for what is one long-running ~daily class.
 * The timeout and non-timeout resets keep separate buckets: one is the watchdog
 * firing on a slow generation, the other a crash-triggered reset.
 */
const GENERATION_TIMEOUT_ERROR = 'Worker was reset after a generation timeout';
const GENERATION_TIMEOUT_FINGERPRINT = 'generation-worker-timeout';
const WORKER_RESET_ERROR = 'Worker was reset';
const WORKER_RESET_FINGERPRINT = 'generation-worker-reset';

/**
 * Per-session capture ceilings.
 *
 * Error tracking has its own monthly exception quota, and one looping client
 * can consume weeks of it: a stale-bundle session averages dozens of
 * chunk-load captures (each doomed retry can be captured both natively and by
 * a boundary), and a single such day has burned most of a month's allowance.
 *
 * A stale bundle is one condition for the whole tab (see lazyWithRetry), so
 * the first chunk-load capture says everything the rest of the session's
 * would. Every other identity keeps enough repeats to triage, then goes
 * quiet for the session.
 */
const SESSION_EXCEPTION_CAP = 10;
const sessionCaptureCounts = new Map<string, number>();
let chunkLoadCaptured = false;

/** Test seam: clears the per-session capture counters. */
export function resetSessionCaptureCounts(): void {
  sessionCaptureCounts.clear();
  chunkLoadCaptured = false;
}

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
  // iOS in-app browsers (WKWebView hosts) inject bridge scripts that call
  // `window.webkit.messageHandlers.<handler>.postMessage`. In a frame where the
  // host app didn't register the handler the chain is undefined and the injected
  // script throws. No app code is involved — we never touch `webkit`.
  /webkit\.messageHandlers/,
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
  type?: string;
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
  /Cannot read propert(?:y|ies) of null \(reading '?addEventListener'?\)|null is not an object \(evaluating '[^']*\.addEventListener'\)|can't access property "addEventListener", .* is null/;

function isCanvasTeardownRace(exception: ExceptionLike): boolean {
  if (!exception.value || !NULL_LISTENER_TARGET.test(exception.value)) return false;
  // `connect` and `onCreated` are property names on object literals, so they
  // survive minification where the surrounding function names do not.
  return (exception.stacktrace?.frames ?? []).some((f) => f.function?.endsWith('connect') === true);
}

/**
 * WebKit fires `unhandledrejection` for promises the navigation itself killed:
 * leaving a page rejects every in-flight `fetch` with a bare `AbortError`
 * carrying no stack. Chrome swallows those rejections, which is why the class
 * is WebKit-only in tracking — an abort our own code leaked would surface
 * cross-browser. Nothing failed; the user left.
 *
 * Gated on the absence of frames: an AbortError thrown through app code has a
 * stack, and that one we want to hear about.
 */
function isNavigationAbort(exception: ExceptionLike): boolean {
  if (exception.value === undefined || !exception.value.startsWith('AbortError')) return false;
  return (exception.stacktrace?.frames ?? []).length === 0;
}

/**
 * PostHog `before_send` hook. Drops `$exception` events whose **primary**
 * exception matches the extension/noise filters, the R3F canvas teardown
 * race, or a stackless navigation abort; dedupes the WebGL context-creation
 * burst, pins chunk-load failures to one fingerprint and captures them once
 * per session, caps every exception identity's captures per session, and
 * passes everything else through unchanged.
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
  if (primaryException && isNavigationAbort(primaryException)) return null;

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
    if (chunkLoadCaptured) return null;
    chunkLoadCaptured = true;
    event.properties = {
      ...event.properties,
      $exception_fingerprint: CHUNK_LOAD_FINGERPRINT,
    };
  }

  // Longer message first: the timeout wording contains the bare reset wording.
  if (primary !== undefined && primary.includes(GENERATION_TIMEOUT_ERROR)) {
    event.properties = {
      ...event.properties,
      $exception_fingerprint: GENERATION_TIMEOUT_FINGERPRINT,
    };
  } else if (primary !== undefined && primary.includes(WORKER_RESET_ERROR)) {
    event.properties = {
      ...event.properties,
      $exception_fingerprint: WORKER_RESET_FINGERPRINT,
    };
  }

  // Pinned fingerprints group reliably; everything else keys on type + message
  // prefix, which is stable enough to recognize a loop even though the
  // server-side fingerprint isn't known at capture time.
  const identity =
    event.properties?.$exception_fingerprint ??
    `${primaryException?.type ?? ''}:${primary?.slice(0, 120) ?? ''}`;
  const captured = (sessionCaptureCounts.get(identity) ?? 0) + 1;
  sessionCaptureCounts.set(identity, captured);
  if (captured > SESSION_EXCEPTION_CAP) return null;

  return event;
}
