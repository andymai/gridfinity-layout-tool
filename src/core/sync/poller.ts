import { pullState, resetPullState } from './pullState';
import { PAYLOAD_KEY } from './payloadKey';
import { apiFetch } from './apiFetch';
import { useSessionStore } from './session/useSession';
import { useSyncStatusStore } from './status';
import { isKindServed, noteServedKinds, servedGatedKinds } from './servedKinds';
import { enqueue as outboxEnqueue, getAll as outboxGetAll } from './outbox';
import type { SyncAdapter, SyncAdapters, SyncKind } from './adapters/types';

interface IndexEntry {
  modifiedAt: number;
  sizeBytes: number;
  deletedAt?: number;
}

// Indexed by SyncKind; every kind optional, since a manifest from a server
// predating that key omits it.
type ManifestResponse = Partial<Record<SyncKind, Record<string, IndexEntry>>> & {
  indexUpdatedAt: number;
};

interface ItemFetchResponse {
  envelope: {
    layout?: unknown;
    design?: unknown;
    baseplate?: unknown;
    designVersion?: unknown;
    folder?: unknown;
    cutoutItem?: unknown;
    cutoutFolder?: unknown;
    modifiedAt: number;
    schemaVersion: number;
  };
  indexEntry: IndexEntry;
}

export interface PullResult {
  status: 'not-modified' | 'applied' | 'unauthorized' | 'offline' | 'error';
  applied?: number;
  /** Set on 'applied'; the value the next pull should send as If-Modified-Since. */
  indexUpdatedAt?: number;
}

/**
 * Single-flight pull. Concurrent callers (timer + on-focus) await the
 * same promise so we never send two manifest fetches at once.
 */
export async function pullNow(adapters: SyncAdapters): Promise<PullResult> {
  if (pullState.held) return { status: 'unauthorized' };
  if (pullState.inFlight) return pullState.inFlight;
  // A pull ended by a reset can finish after a newer one took the slot.
  const pull = run(adapters, pullState.generation).finally(() => {
    if (pullState.inFlight === pull) pullState.inFlight = null;
  });
  pullState.inFlight = pull;
  return pull;
}

/**
 * End this account's pulls: the next pull starts over, and one in flight makes
 * no further local write. Settles once every write in progress has landed.
 */
export function endPulls(): Promise<void> {
  const writing = pullState.writing;
  resetPullState();
  return writing.then(() => undefined);
}

/** {@link endPulls}, and start no pull until `release`, so none races a wipe. */
export function holdPulls(): { ended: Promise<void>; release: () => void } {
  pullState.held = true;
  return {
    ended: endPulls(),
    release: () => {
      pullState.held = false;
    },
  };
}

export function __resetForTests(): void {
  resetPullState();
  pullState.held = false;
  pullState.writing = Promise.resolve();
}

async function run(adapters: SyncAdapters, capturedGeneration: number): Promise<PullResult> {
  if (useSessionStore.getState().status !== 'authenticated') {
    return { status: 'unauthorized' };
  }

  useSyncStatusStore.getState().beginSync();

  let manifestRes: Response;
  try {
    manifestRes = await apiFetch('/api/sync/manifest', {
      headers:
        pullState.lastIndexUpdatedAt > 0
          ? {
              'If-Modified-Since': String(pullState.lastIndexUpdatedAt),
              'X-Sync-Served': servedGatedKinds().join(','),
            }
          : {},
    });
  } catch {
    if (capturedGeneration === pullState.generation) {
      useSyncStatusStore.getState().reportOffline('manifest fetch failed');
    }
    return { status: 'offline' };
  }

  if (capturedGeneration !== pullState.generation) return { status: 'offline' };

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

  // Baseplates first: a layout references a baseplate design by id, and the
  // init hook orphans that pointer (NOT_FOUND) if the design isn't local yet.
  // On a fresh device the referenced design must land before its layout.
  const baseplateChanges = await diffKind(
    adapters.baseplates,
    'baseplates',
    manifest.baseplates ?? {},
    capturedGeneration
  );
  // Folders before layouts for the same reason: a layout names its folder,
  // and it should land somewhere that exists.
  const folderChanges = await diffKind(
    adapters.folders,
    'folders',
    manifest.folders ?? {},
    capturedGeneration
  );
  const layoutChanges = await diffKind(
    adapters.layouts,
    'layouts',
    manifest.layouts ?? {},
    capturedGeneration
  );
  const designChanges = await diffKind(
    adapters.designs,
    'designs',
    manifest.designs ?? {},
    capturedGeneration
  );
  // Versions last: a pulled version is only reachable through its design's
  // history list, so nothing breaks if it lands after the design it belongs to.
  const versionChanges = await diffKind(
    adapters.designVersions,
    'designVersions',
    manifest.designVersions ?? {},
    capturedGeneration
  );
  // A gated kind syncs only while the manifest lists it. Library folders come
  // before items, as layout folders come before layouts.
  // A pull ended by a reset must not restore the ended session's served kinds.
  if (capturedGeneration !== pullState.generation) return { status: 'offline' };
  const newlyServed = noteServedKinds(manifest);
  let libraryChanges = 0;
  for (const kind of ['cutoutFolders', 'cutoutItems'] as const) {
    if (!isKindServed(kind)) continue;
    const remote = manifest[kind] ?? {};
    // A change held while the switch was off is newer than what the server
    // has: a held delete must not be undone by pulling the item back.
    const held = new Set(
      (await outboxGetAll()).filter((entry) => entry.kind === kind).map((entry) => entry.id)
    );
    libraryChanges += await diffKind(adapters[kind], kind, remote, capturedGeneration, held);
    if (newlyServed.includes(kind)) {
      await queueUnsynced(adapters[kind], kind, remote, capturedGeneration);
    }
  }
  const applied =
    layoutChanges +
    designChanges +
    baseplateChanges +
    versionChanges +
    folderChanges +
    libraryChanges;

  // Reset happened mid-flight — drop our results to avoid re-installing the
  // prior user's high-water mark or applying writes that belong to a session
  // that's been torn down.
  if (capturedGeneration !== pullState.generation) return { status: 'offline' };

  pullState.lastIndexUpdatedAt = manifest.indexUpdatedAt;
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
 * A pull whose account's pulls have ended stops before its next write.
 */
async function diffKind(
  adapter: SyncAdapter,
  kind: SyncKind,
  remote: Record<string, IndexEntry>,
  generation: number,
  skip: ReadonlySet<string> = new Set()
): Promise<number> {
  const localItems = await adapter.list();
  const localByMtime = new Map<string, number>();
  for (const item of localItems) localByMtime.set(item.id, item.modifiedAt);

  let applied = 0;
  for (const [id, entry] of Object.entries(remote)) {
    if (generation !== pullState.generation) break;
    if (skip.has(id)) continue;
    const localMtime = localByMtime.get(id);

    if (entry.deletedAt !== undefined) {
      if (localMtime !== undefined && localMtime < entry.deletedAt) {
        await trackWrite(adapter.applyRemoteDelete(id));
        applied++;
      }
      continue;
    }

    if (localMtime === undefined || localMtime < entry.modifiedAt) {
      const fetched = await fetchEnvelope(kind, id);
      if (!fetched || generation !== pullState.generation) continue;
      const payload = fetched.envelope[PAYLOAD_KEY[kind]];
      if (payload === undefined) continue;
      await trackWrite(
        adapter.applyRemote({
          id,
          payload,
          modifiedAt: fetched.envelope.modifiedAt,
          schemaVersion: fetched.envelope.schemaVersion,
        })
      );
      applied++;
    }
  }
  return applied;
}

/**
 * Queue each local item the server lacks or holds older. Runs when a gated
 * kind first appears in a session's manifest: what was saved while its sync
 * was off reached no outbox, or was held there unsent.
 */
async function queueUnsynced(
  adapter: SyncAdapter,
  kind: SyncKind,
  remote: Record<string, IndexEntry>,
  generation: number
): Promise<void> {
  for (const item of await adapter.list()) {
    // A sign-out clears the outbox; an entry queued after it would push
    // under the next account.
    if (generation !== pullState.generation) return;
    const entry = remote[item.id] as IndexEntry | undefined;
    const behind =
      entry === undefined ||
      (entry.deletedAt === undefined
        ? entry.modifiedAt < item.modifiedAt
        : entry.deletedAt < item.modifiedAt);
    if (behind) {
      await trackWrite(
        outboxEnqueue({ kind, id: item.id, modifiedAt: item.modifiedAt, op: 'put' })
      );
    }
  }
}

function trackWrite(write: Promise<void>): Promise<void> {
  // Settled to nothing, so a finished write's history can be collected.
  pullState.writing = Promise.all([pullState.writing, write.catch(() => undefined)]).then(
    () => undefined
  );
  return write;
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

export { resetPullState };
