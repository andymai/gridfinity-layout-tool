import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  BaseplateAdapter,
  BaseplatePayload,
  SyncableItem,
} from '@/core/sync/adapters/types';
import type { StoredBaseplateParams } from '@/core/types';
import { baseplateDesignId } from '@/core/types';
import {
  deleteDesign,
  listDesigns,
  loadDesign,
  saveDesign,
} from '@/features/baseplate/storage/BaseplateStorage';
import {
  upsertRegistryEntry,
  removeRegistryEntry,
} from '@/features/baseplate/store/baseplateRegistry';
import { subscribe as subscribeBaseplateEvents } from './baseplateEvents';

// Lives in features/ because StoredBaseplateParams is feature-adjacent and
// this bridges BaseplateStorage to the engine; registered at app-shell boot.
//
// SavedBaseplateDesign stores `updatedAt` as ISO; the cloud envelope is ms.
// We normalize at this boundary so the engine never sees ISO strings.

// Held across the full `saveDesign`/`deleteDesign` await chain because
// the `emit()` that needs suppression fires past internal await boundaries;
// a microtask cleanup would release too early.
const suppressed = new Set<string>();

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/** A params blob must be a plain object; arrays read back as corrupt. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accept either the `{ name, params }` wrapper or a bare params shape so a
 * legacy cloud blob still applies cleanly. Returns `null` for a malformed
 * payload (non-object or array params) so the caller can drop it rather than
 * persist a record that reads back corrupt and vanishes.
 */
function unwrap(payload: unknown): { name?: string; params: StoredBaseplateParams } | null {
  if (payload !== null && typeof payload === 'object' && 'params' in payload) {
    const { name, params } = payload as { name?: unknown; params: unknown };
    if (isPlainObject(params)) {
      // Empty/whitespace-only remote names become `undefined` so the
      // fallback chain kicks in.
      const trimmed = typeof name === 'string' ? name.trim() : '';
      return {
        name: trimmed === '' ? undefined : trimmed,
        params: params as unknown as StoredBaseplateParams,
      };
    }
    return null;
  }
  return isPlainObject(payload) ? { params: payload as unknown as StoredBaseplateParams } : null;
}

export const baseplateAdapter: BaseplateAdapter = {
  async list(): Promise<SyncableItem<BaseplatePayload>[]> {
    const result = await listDesigns();
    if (!isOk(result)) return [];
    return result.value.map((d) => ({
      id: d.id,
      payload: { name: d.name, params: d.params },
      modifiedAt: toMs(d.updatedAt),
    }));
  },

  async get(id: string): Promise<SyncableItem<BaseplatePayload> | null> {
    const result = await loadDesign(baseplateDesignId(id));
    if (!isOk(result)) return null;
    const d = result.value;
    return {
      id: d.id,
      payload: { name: d.name, params: d.params },
      modifiedAt: toMs(d.updatedAt),
    };
  },

  async applyRemote(item: SyncableItem<BaseplatePayload>): Promise<void> {
    suppressed.add(item.id);
    try {
      const unwrapped = unwrap(item.payload);
      if (unwrapped === null) return;
      // Read existing first to preserve local-only fields (thumbnail) on update.
      const existing = await loadDesign(baseplateDesignId(item.id));
      const base = isOk(existing) ? existing.value : null;
      const { name: remoteName, params } = unwrapped;
      // LWW: engine only calls applyRemote when remote is newer, so a
      // remote rename must win. Local name is only a fallback for legacy
      // payloads with no name; the literal covers a legacy fresh-device pull.
      const name = remoteName ?? base?.name ?? 'Synced baseplate';
      const result = await saveDesign({
        id: baseplateDesignId(item.id),
        name,
        params,
        thumbnail: base?.thumbnail ?? null,
      });
      if (!isOk(result)) {
        throw new Error(`saveDesign failed for ${item.id}`);
      }
      // Keep the selector's registry in step with the write we just made to
      // IndexedDB. Done here (not in the shared sync-boot component) so the
      // engine's per-id apply sequencing rules out a delete-after-put race.
      // Registry writes don't emit baseplateEvents, so there's no sync loop.
      const saved = result.value;
      upsertRegistryEntry({ id: saved.id, name: saved.name, updatedAt: saved.updatedAt });
    } finally {
      suppressed.delete(item.id);
    }
  },

  async applyRemoteDelete(id: string): Promise<void> {
    suppressed.add(id);
    try {
      const result = await deleteDesign(baseplateDesignId(id));
      if (!isOk(result) && result.error.code !== 'STORAGE_NOT_FOUND') {
        throw new Error(`deleteDesign failed for ${id}`);
      }
      removeRegistryEntry(baseplateDesignId(id));
    } finally {
      suppressed.delete(id);
    }
  },

  subscribe(listener: AdapterChangeListener): () => void {
    return subscribeBaseplateEvents((event) => {
      if (suppressed.has(event.id)) return;
      const change: AdapterChange =
        event.type === 'put'
          ? { kind: 'put', id: event.id, modifiedAt: toMs(event.updatedAt) }
          : { kind: 'delete', id: event.id, modifiedAt: toMs(event.deletedAt) };
      listener(change);
    });
  },
};
