import { useEffect } from 'react';
import { getPendingEntries } from '../engine';
import type { SyncAdapters, SyncKind } from '../adapters/types';

const BEACON_MAX_BYTES = 60 * 1024;

interface PreparedBeacon {
  url: string;
  blob: Blob;
}

/**
 * On `pagehide`, send a beacon for every pending outbox PUT so the
 * server learns about the latest state even if the tab is closing.
 * `fetch` would be cancelled at unload; `sendBeacon` survives. DELETE
 * entries are skipped — beacon can't express the verb; the next session
 * picks them up from the persisted outbox.
 *
 * Two-phase flow: `visibilitychange → hidden` does the async prep (IDB
 * reads, adapter snapshots), and `pagehide` fires every prepared beacon
 * synchronously with zero awaits. The earlier `visibilitychange` signal
 * usually arrives well before `pagehide`, so by the time the browser is
 * tearing the page down, the data is already a `Blob` ready to ship.
 *
 * Cache is refreshed on every visibility-hidden transition — a user who
 * tabs away and comes back to edit more sees a fresh prep on the next
 * transition.
 */
export function useBeaconFlush(adapters: SyncAdapters): void {
  useEffect(() => {
    let prepared: PreparedBeacon[] = [];

    const refreshPrepared = async (): Promise<void> => {
      prepared = await collectBeacons(adapters);
    };

    const onVisibility = (): void => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        // Best-effort; if it doesn't finish before pagehide the next
        // session's outbox replay still catches the changes.
        refreshPrepared().catch(() => {
          /* swallow — beacon is best-effort */
        });
      }
    };

    const onPageHide = (): void => {
      // SYNCHRONOUS path: no awaits. By this point `prepared` was filled
      // by the prior visibility-hidden tick, so every beacon fires right
      // here in the unload window where the browser actually waits.
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
      for (const { url, blob } of prepared) {
        try {
          navigator.sendBeacon(url, blob);
        } catch {
          /* next session retries from the persisted outbox */
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [adapters]);
}

async function collectBeacons(adapters: SyncAdapters): Promise<PreparedBeacon[]> {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return [];
  let entries;
  try {
    entries = await getPendingEntries();
  } catch {
    return [];
  }
  const prepared: PreparedBeacon[] = [];
  for (const entry of entries) {
    if (entry.op === 'delete') continue;
    const adapter = adapters[entry.kind];
    let payload: { id: string; payload: unknown; modifiedAt: number } | null;
    try {
      payload = await adapter.get(entry.id);
    } catch {
      continue;
    }
    if (!payload) continue;
    const body = bodyForKind(entry.kind, payload.payload, payload.modifiedAt);
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    if (blob.size > BEACON_MAX_BYTES) continue;
    prepared.push({ url: `/api/sync/${entry.kind}/${entry.id}`, blob });
  }
  return prepared;
}

function bodyForKind(kind: SyncKind, payload: unknown, modifiedAt: number): object {
  if (kind === 'layouts') return { layout: payload, modifiedAt };
  return { design: payload, modifiedAt };
}
