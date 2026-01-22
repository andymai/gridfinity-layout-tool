/**
 * Utility for scheduling work during browser idle periods.
 * This helps improve INP by deferring non-critical work like storage operations.
 */

type IdleCallback = (deadline: IdleDeadline) => void;

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

/**
 * Schedule a callback to run during browser idle time.
 * Falls back to setTimeout if requestIdleCallback is not available.
 *
 * @param callback - Function to run during idle time
 * @param options - Options including timeout
 * @returns A handle that can be used to cancel the callback
 */
export function scheduleIdleCallback(
  callback: IdleCallback,
  options?: { timeout?: number }
): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, options);
  }

  // Fallback for browsers without requestIdleCallback (Safari < 16.4)
  // Use setTimeout with a small delay to yield to more critical work
  const timeoutId = window.setTimeout(() => {
    callback({
      didTimeout: true,
      timeRemaining: () => 0,
    });
  }, options?.timeout ?? 50);

  return timeoutId;
}

/**
 * Cancel a scheduled idle callback.
 *
 * @param handle - The handle returned by scheduleIdleCallback
 */
export function cancelIdleCallback(handle: number): void {
  if (typeof window.cancelIdleCallback !== 'undefined') {
    window.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

