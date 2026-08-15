/**
 * Start loading a destination the moment someone reaches for it.
 *
 * Every editor in the tool switcher is a lazy route, so today the chunk fetch
 * only begins on the click and the panel stays blank until it lands —
 * measured at ~0.9s on a good connection and ~2.9s on a slow one, all of it
 * after the user has already committed. A pointer sits on a control for a few
 * hundred milliseconds before the button goes down, and a keyboard user
 * focuses it first; both are a commitment strong enough to spend a chunk on
 * and early enough to be worth something.
 *
 * `pointerenter` covers mouse and pen. Touch never hovers, so it is answered
 * by `pointerdown` instead — that is only ~100ms of head start, but it is the
 * whole of the warning a touch device gives, and the idle tier-prefetch
 * deliberately stands down on those devices.
 *
 * Fire-and-forget and idempotent: a rejected import means the chunk loads
 * normally when the route actually mounts, and re-entering a control costs
 * nothing after the first time.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { shouldSkipPrefetch } from '@/shared/utils/prefetchPolicy';

/** Destinations already warmed this session, so repeat hovers are free. */
const started = new Set<string>();

/** Handlers to spread onto the element that leads to `key`'s destination. */
export interface IntentPrefetchHandlers {
  readonly onPointerEnter: () => void;
  readonly onPointerDown: () => void;
  readonly onFocus: () => void;
}

/**
 * Warm `key`'s destination now, at most once per session. Exported for call
 * sites that already own their handlers and only need the one-shot guard.
 */
export function prefetchOnIntent(key: string, warm: () => void): void {
  if (started.has(key) || shouldSkipPrefetch()) return;
  started.add(key);
  try {
    warm();
  } catch {
    // Speculative by definition — the destination still loads on demand.
  }
}

/**
 * Handlers that warm `key`'s destination on the first sign of intent.
 *
 * `warm` is held in a ref so call sites can pass an inline arrow without
 * rebuilding the handler identities on every render — the destination is
 * identified by `key`, not by the closure that loads it.
 */
export function useIntentPrefetch(key: string, warm: () => void): IntentPrefetchHandlers {
  const warmRef = useRef(warm);
  useEffect(() => {
    warmRef.current = warm;
  }, [warm]);

  const fire = useCallback(() => {
    prefetchOnIntent(key, () => warmRef.current());
  }, [key]);

  return useMemo(() => ({ onPointerEnter: fire, onPointerDown: fire, onFocus: fire }), [fire]);
}

/** @internal — for tests; session state would otherwise leak between cases. */
export function resetIntentPrefetchForTests(): void {
  started.clear();
}
