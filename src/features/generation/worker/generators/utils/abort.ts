/**
 * Abort/cancellation utilities for the generation pipeline.
 *
 * Centralizes the AbortError check pattern used across 5+ files
 * and the mid-operation cancellation helper.
 */

/** Returns true if the error is an AbortError from a cancelled operation. */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/** Throw if the AbortSignal has been triggered (mid-operation cancellation). */
export function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
}
