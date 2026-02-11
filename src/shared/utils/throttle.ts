/**
 * Throttle utility using requestAnimationFrame for smooth 60fps interactions.
 * This is more appropriate than time-based throttling for UI interactions
 * because it aligns with the browser's rendering cycle.
 */

/**
 * Type for callable functions that can be used as WeakMap keys.
 *
 * Note: We use `any[]` here because TypeScript's type system cannot express
 * "any function" in a way that satisfies WeakMap's key constraint without `any`.
 * The public API (throttleRAF, throttle) preserves full type safety through
 * generics - this internal type is just for storage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for WeakMap key constraint with generic functions
type ThrottledFunction = (...args: any[]) => void;

// WeakMap to store RAF IDs for each throttled function
const rafIds = new WeakMap<ThrottledFunction, number>();
const pendingArgs = new WeakMap<ThrottledFunction, unknown[]>();
const pendingThis = new WeakMap<ThrottledFunction, unknown>();

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic constraint for any callable function type
export function throttleRAF<T extends (...args: any[]) => void>(fn: T): T {
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
      fn.apply(latestThis, latestArgs);
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
export function cancelThrottledRAF(throttledFn: ThrottledFunction): void {
  const rafId = rafIds.get(throttledFn);
  if (rafId !== undefined) {
    cancelAnimationFrame(rafId);
    rafIds.delete(throttledFn);
  }
}

/**
 * Creates a time-based throttled version of a function.
 *
 * Unlike throttleRAF which uses requestAnimationFrame, this function
 * uses a fixed time interval. This is more appropriate for network
 * operations where we want to limit request frequency rather than
 * align with rendering frames.
 *
 * @param fn The function to throttle
 * @param delay The minimum time between calls in milliseconds
 * @returns A throttled version of the function
 *
 * @example
 * const throttledUpdate = throttle((data) => {
 *   sendToServer(data);
 * }, 50); // Max 20 calls per second
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic constraint for any callable function type
export function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // Store latest args for trailing call
    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- Required for preserving context in delayed execution
    lastThis = this;

    if (timeSinceLastCall >= delay) {
      // Enough time has passed, execute immediately
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      // Schedule a trailing call
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        if (lastArgs) {
          fn.apply(lastThis, lastArgs);
        }
      }, delay - timeSinceLastCall);
    }
  } as T;

  return throttled;
}
