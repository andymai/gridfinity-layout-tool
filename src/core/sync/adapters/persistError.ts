import type { StorageError } from '@/core/result';

/**
 * Build the Error a sync adapter throws when a local persist fails while
 * applying a remote change. The engine surfaces the throw through
 * `reportUncaught`, which reads `error.message`, and exception autocapture
 * walks `Error.cause` — so folding the `StorageError.code` into the message
 * and attaching the error as `cause` names *why* the write failed (quota,
 * unavailable, corrupted) instead of a bare "saveDesign failed for X" that
 * no telemetry can act on.
 */
export function syncPersistError(operation: string, id: string, error: StorageError): Error {
  return new Error(`${operation} failed for ${id}: ${error.code}`, { cause: error });
}
