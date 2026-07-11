import { useEffect } from 'react';
import { getPendingEntries } from '../engine';
import type { SyncAdapters, SyncKind } from '../adapters/types';

const BEACON_MAX_BYTES = 60 * 1024;

interface PreparedBeacon {
  url: string;
  blob: Blob;
}

// Async prep on `visibilitychange → hidden`, synchronous send on `pagehide`.
// `fetch` is cancelled at unload but `sendBeacon` survives, so beacons must
// be pre-built before the browser tears the page down. DELETE entries are
// skipped (beacon has no verb); the next session replays them from the outbox.
export function useBeaconFlush(adapters: SyncAdapters): void {
  useEffect(() => {
    let prepared: PreparedBeacon[] = [];
    // Monotonic token so a slow earlier refresh can't overwrite a newer
    // one. Without this, two visibility-hidden events in flight would race
    // and the later (fresher) result could be clobbered by the earlier.
    let refreshSeq = 0;

    const refreshPrepared = async (): Promise<void> => {
      const mySeq = ++refreshSeq;
      const next = await collectBeacons(adapters);
      if (mySeq === refreshSeq) prepared = next;
    };

    const onVisibility = (): void => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        refreshPrepared().catch(() => {
          /* best-effort */
        });
      }
    };

    // No awaits — must stay synchronous inside the unload window.
    const onPageHide = (): void => {
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
  if (kind === 'baseplates') return { baseplate: payload, modifiedAt };
  return { design: payload, modifiedAt };
}
