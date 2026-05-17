/**
 * Browser-extension and platform noise we don't want in PostHog.
 *
 * Extensions (ad blockers, password managers, dev tools, etc.) inject scripts
 * into the page context. When those scripts throw, our `window.onerror` /
 * `unhandledrejection` listeners catch them and PostHog's `capture_exceptions`
 * also auto-captures them — surfacing as errors whose only stack frame points
 * at `init.ts`, looking like our bug. They're not.
 */

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
  };
}

/**
 * PostHog `before_send` hook. Drops `$exception` events that match the
 * extension/noise filters; passes everything else through unchanged.
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
  const list = event.properties?.$exception_list ?? [];
  const values = event.properties?.$exception_values ?? [];
  const messages = [...list.map((e) => e.value), ...values];
  for (const msg of messages) {
    if (shouldIgnoreError(msg)) return null;
  }
  return event;
}
