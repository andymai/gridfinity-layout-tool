import { useEffect } from 'react';
import { getPendingEntries } from '../engine';
import type { OutboxEntry } from '../outbox';
import type { SyncAdapters, SyncKind } from '../adapters/types';

const BEACON_MAX_BYTES = 60 * 1024;

/**
 * On `pagehide`, send a beacon for every pending outbox PUT so the
 * server learns about the latest state even if the tab is closing.
 * `fetch` would be cancelled at unload; `sendBeacon` survives. DELETE
 * entries are skipped — beacon can't express the verb; the next session
 * picks them up from the persisted outbox.
 */
export function useBeaconFlush(adapters: SyncAdapters): void {
  useEffect(() => {
    const onPageHide = (): void => {
      void beaconFlushAll(adapters);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [adapters]);
}

async function beaconFlushAll(adapters: SyncAdapters): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  let entries: OutboxEntry[];
  try {
    entries = await getPendingEntries();
  } catch {
    return;
  }

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
    const json = JSON.stringify(body);
    const blob = new Blob([json], { type: 'application/json' });
    if (blob.size > BEACON_MAX_BYTES) continue;
    try {
      navigator.sendBeacon(`/api/sync/${entry.kind}/${entry.id}`, blob);
    } catch {
      /* next session retries from the persisted outbox */
    }
  }
}

function bodyForKind(kind: SyncKind, payload: unknown, modifiedAt: number): object {
  if (kind === 'layouts') return { layout: payload, modifiedAt };
  return { design: payload, modifiedAt };
}
