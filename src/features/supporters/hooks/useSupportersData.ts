import { useEffect, useState } from 'react';
import {
  FALLBACK_SUPPORTERS,
  isSupportersData,
  type SupportersData,
} from '../utils/supportersData';

/**
 * Beyond this the bundled list is better than an empty hero. Kept tight: the
 * page holds its render until this settles, and the payload is a ~1KB
 * edge-cached same-origin GET.
 */
export const FETCH_TIMEOUT_MS = 1500;

/**
 * Fetch the live supporter list, falling back to the bundled snapshot.
 *
 * Redis is the source of truth (a Ko-fi webhook writes to it), so the bundled
 * JSON is only a safety net for an unreachable or misconfigured API — a stale
 * baseplate beats an empty one. `settled` lets the page hold the scene until we
 * know the real count, so the camera frames once instead of re-framing when the
 * fetch lands.
 */
export function useSupportersData(): { data: SupportersData; settled: boolean } {
  const [data, setData] = useState<SupportersData>(FALLBACK_SUPPORTERS);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // Distinguishes unmount (don't touch state) from our own timeout abort
    // (still settle, so the page stops waiting and renders the fallback).
    let cancelled = false;
    const controller = new AbortController();
    // The page holds its hero until we settle, so a hanging request must not
    // hold it forever — give up and use the bundled list instead.
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch('/api/supporters', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        // An empty store means the seed hasn't run — keep the bundled list
        // rather than wiping the baseplate to nothing.
        if (isSupportersData(json) && json.named.length + json.anonymousCount > 0) {
          setData(json);
        }
      })
      .catch(() => {
        // Offline, blocked, 5xx, or our own timeout — the fallback covers it.
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return { data, settled };
}
