import { useEffect, useRef } from 'react';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { useSessionStore } from '../session/useSession';
import { flushNow } from '../engine';

const DEBOUNCE_MS = 3_000;

/**
 * Flush the outbox 3s after the last local save settles. The outbox
 * upserts re-enqueues, so a burst of edits collapses to one push.
 * Anonymous and unknown sessions skip the flush — the engine isn't
 * running so `flushNow` would be a no-op anyway, but the explicit gate
 * documents the contract and matches the pull-side guard.
 */
export function useDebouncedPush(): void {
  const layout = useLayoutStore((s) => s.layout);
  const lastEditSource = useLayoutStore((s) => s.lastEditSource);
  const library = useLibraryStore((s) => s.library);
  const status = useSessionStore((s) => s.status);
  const timerRef = useRef<number | undefined>(undefined);
  const firstTickRef = useRef(true);

  useEffect(() => {
    if (firstTickRef.current) {
      firstTickRef.current = false;
      return;
    }
    if (status !== 'authenticated') return;
    if (lastEditSource === 'remote') return;

    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void flushNow();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [layout, library, lastEditSource, status]);
}
