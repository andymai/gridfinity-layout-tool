import { useEffect, useState } from 'react';

/**
 * Counter that increments when the browser regains connectivity, but only while
 * `failed` is true. Use it as an effect dependency so a one-shot fetch that
 * failed offline runs again — otherwise the feature stays dark until the
 * component happens to remount.
 */
export function useRetryOnReconnect(failed: boolean): number {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!failed) return;
    const retry = (): void => setAttempt((n) => n + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failed]);

  return attempt;
}
