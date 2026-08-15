/**
 * When the browser has told us not to spend bandwidth speculatively.
 *
 * Shared by the idle tier-prefetch (`usePrefetchChunks`) and the pointer-intent
 * prefetch (`useIntentPrefetch`) so a data-saver visitor is not exempted from
 * one and quietly charged by the other.
 */

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** True when the connection signals data-saver or a very slow link. */
export function shouldSkipPrefetch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as { connection?: NetworkInformation }).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g'
  );
}
