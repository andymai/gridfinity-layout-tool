import { apiFetch } from './apiFetch';
import { useSyncStatusStore } from './status';
import type { SyncAdapter, SyncAdapters, SyncKind } from './adapters/types';

interface IndexEntry {
  modifiedAt: number;
  sizeBytes: number;
  deletedAt?: number;
}

interface ManifestResponse {
  layouts: Record<string, IndexEntry>;
  designs: Record<string, IndexEntry>;
  indexUpdatedAt: number;
}

interface ItemFetchResponse {
  envelope: { layout?: unknown; design?: unknown; modifiedAt: number; schemaVersion: number };
  indexEntry: IndexEntry;
}

export interface PullResult {
  status: 'not-modified' | 'applied' | 'unauthorized' | 'offline' | 'error';
  applied?: number;
  /** Set on 'applied'; the value the next pull should send as If-Modified-Since. */
  indexUpdatedAt?: number;
}

let lastIndexUpdatedAt = 0;
let inFlight: Promise<PullResult> | null = null;
// Bumped by `resetPullState`. `run()` captures the value at call time;
// if it changes before the run finishes, the run abandons its writes.
// Prevents a pre-reset pull from re-installing the prior user's
// `lastIndexUpdatedAt` after sign-out.
let generation = 0;

/**
 * Single-flight pull. Concurrent callers (timer + on-focus) await the
 * same promise so we never send two manifest fetches at once.
 */
export async function pullNow(adapters: SyncAdapters): Promise<PullResult> {
  if (inFlight) return inFlight;
  inFlight = run(adapters, generation).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// Reset on sign-out: without this the next user's first poll would send
// the prior user's `lastIndexUpdatedAt` as `If-Modified-Since`. Bumping
// `generation` also poisons any in-flight `run()` so its late completion
// can't re-install stale state.
export function resetPullState(): void {
  lastIndexUpdatedAt = 0;
  inFlight = null;
  generation++;
}

export function __resetForTests(): void {
  resetPullState();
}

async function run(adapters: SyncAdapters, capturedGeneration: number): Promise<PullResult> {
  useSyncStatusStore.getState().beginSync();

  let manifestRes: Response;
  try {
    manifestRes = await apiFetch('/api/sync/manifest', {
      headers: lastIndexUpdatedAt > 0 ? { 'If-Modified-Since': String(lastIndexUpdatedAt) } : {},
    });
  } catch {
    if (capturedGeneration === generation) {
      useSyncStatusStore.getState().reportOffline('manifest fetch failed');
    }
    return { status: 'offline' };
  }

  if (capturedGeneration !== generation) return { status: 'offline' };

  if (manifestRes.status === 304) {
    useSyncStatusStore.getState().succeed();
    return { status: 'not-modified' };
  }
  if (manifestRes.status === 401) {
    return { status: 'unauthorized' };
  }
  if (manifestRes.status === 429) {
    // Server throttling, not a real error. Treat as transient offline so
    // the periodic poll caller backs off — mirrors the push-side 429
    // handling in `engine.ts`.
    useSyncStatusStore.getState().reportOffline('Rate limited');
    return { status: 'offline' };
  }
  if (!manifestRes.ok) {
    useSyncStatusStore.getState().reportError(`manifest ${manifestRes.status}`);
    return { status: 'error' };
  }

  const manifest = (await manifestRes.json()) as ManifestResponse;

  const layoutChanges = await diffKind(adapters.layouts, 'layouts', manifest.layouts);
  const designChanges = await diffKind(adapters.designs, 'designs', manifest.designs);
  const applied = layoutChanges + designChanges;

  // Reset happened mid-flight — drop our results to avoid re-installing the
  // prior user's high-water mark or applying writes that belong to a session
  // that's been torn down.
  if (capturedGeneration !== generation) return { status: 'offline' };

  lastIndexUpdatedAt = manifest.indexUpdatedAt;
  useSyncStatusStore.getState().succeed();
  return { status: 'applied', applied, indexUpdatedAt: manifest.indexUpdatedAt };
}

/**
 * For each remote entry, decide what to apply locally:
 *   - tombstone with `deletedAt > local.modifiedAt` → applyRemoteDelete
 *   - live entry with `modifiedAt > local.modifiedAt` → fetch + applyRemote
 * Returns the count of items applied.
 *
 * Locals not in the manifest aren't our problem — push handles those.
 */
async function diffKind(
  adapter: SyncAdapter,
  kind: SyncKind,
  remote: Record<string, IndexEntry>
): Promise<number> {
  const localItems = await adapter.list();
  const localByMtime = new Map<string, number>();
  for (const item of localItems) localByMtime.set(item.id, item.modifiedAt);

  let applied = 0;
  for (const [id, entry] of Object.entries(remote)) {
    const localMtime = localByMtime.get(id);

    if (entry.deletedAt !== undefined) {
      if (localMtime !== undefined && localMtime < entry.deletedAt) {
        await adapter.applyRemoteDelete(id);
        applied++;
      }
      continue;
    }

    if (localMtime === undefined || localMtime < entry.modifiedAt) {
      const fetched = await fetchEnvelope(kind, id);
      if (!fetched) continue;
      const payload = kind === 'layouts' ? fetched.envelope.layout : fetched.envelope.design;
      if (payload === undefined) continue;
      await adapter.applyRemote({
        id,
        payload,
        modifiedAt: fetched.envelope.modifiedAt,
      });
      applied++;
    }
  }
  return applied;
}

async function fetchEnvelope(kind: SyncKind, id: string): Promise<ItemFetchResponse | null> {
  let res: Response;
  try {
    res = await apiFetch(`/api/sync/${kind}/${id}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return (await res.json()) as ItemFetchResponse;
  } catch {
    return null;
  }
}
