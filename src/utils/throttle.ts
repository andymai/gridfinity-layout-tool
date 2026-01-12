/**
 * Throttle utility using requestAnimationFrame for smooth 60fps interactions.
 * This is more appropriate than time-based throttling for UI interactions
 * because it aligns with the browser's rendering cycle.
 */

// Type for any callable function (WeakMap key compatible)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => void;

// WeakMap to store RAF IDs for each throttled function
const rafIds = new WeakMap<AnyFunction, number>();
const pendingArgs = new WeakMap<AnyFunction, unknown[]>();
const pendingThis = new WeakMap<AnyFunction, unknown>();

/**
 * Creates a throttled version of a function that uses requestAnimationFrame.
 *
 * - First call executes immediately
 * - Subsequent calls are batched and execute on the next animation frame
 * - Only the latest arguments are used when the batched call executes
 *
 * This is ideal for pointer move handlers where we want:
 * 1. Immediate response to user input
 * 2. At most one update per frame (60fps cap)
 * 3. Latest position data, not stale queued data
 *
 * @param fn The function to throttle
 * @returns A throttled version of the function
 *
 * @example
 * const throttledMove = throttleRAF((x, y) => {
 *   updatePosition(x, y);
 * });
 *
 * element.addEventListener('pointermove', (e) => {
 *   throttledMove(e.clientX, e.clientY);
 * });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttleRAF<T extends (...args: any[]) => void>(
  fn: T
): T {
  let isScheduled = false;
  let canExecuteImmediately = true;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    // Store latest args and context
    pendingArgs.set(throttled, args);
    pendingThis.set(throttled, this);

    // Execute immediately if no RAF is pending
    if (canExecuteImmediately) {
      canExecuteImmediately = false;
      fn.apply(this, args);
      return;
    }

    // If already scheduled, just update args (will use latest on next frame)
    if (isScheduled) {
      return;
    }

    isScheduled = true;

    const rafId = requestAnimationFrame(() => {
      isScheduled = false;
      const latestArgs = pendingArgs.get(throttled) as Parameters<T>;
      const latestThis = pendingThis.get(throttled);
      if (latestArgs) {
        fn.apply(latestThis, latestArgs);
      }
      // After RAF completes, allow immediate execution for next call
      canExecuteImmediately = true;
    });

    rafIds.set(throttled, rafId);
  } as T;

  return throttled;
}

/**
 * Cancels any pending RAF for a throttled function.
 * Safe to call on non-throttled functions (no-op).
 *
 * @param throttledFn The throttled function to cancel
 */
export function cancelThrottledRAF(throttledFn: AnyFunction): void {
  const rafId = rafIds.get(throttledFn);
  if (rafId !== undefined) {
    cancelAnimationFrame(rafId);
    rafIds.delete(throttledFn);
  }
}
