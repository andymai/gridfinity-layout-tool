import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  DesignAdapter,
  DesignSyncPayload,
  SyncableItem,
} from '@/core/sync/adapters/types';
import { designId } from '@/core/types';
import type { BinParams } from '@/features/bin-designer/types';
import {
  deleteDesign,
  listDesigns,
  loadDesign,
  saveDesign,
} from '@/features/bin-designer/storage/DesignerStorage';
import { subscribe as subscribeDesignerEvents } from './designerEvents';

// Lives in features/ because BinParams is feature-internal; core/ can't
// import it. Registered with the engine at app-shell boot.
//
// SavedDesign stores `updatedAt` as ISO; the cloud envelope is ms. We
// normalize at this boundary so the engine never sees ISO strings.

// Held across the full `saveDesign`/`deleteDesign` await chain because
// the `emit()` that needs suppression fires past internal await boundaries;
// a microtask cleanup would release too early.
const suppressed = new Set<string>();

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Accept either the new `{ name, params }` wrapper or the legacy bare
 * `BinParams` shape so pre-name cloud blobs still apply cleanly.
 */
function unwrap(payload: unknown): { name?: string; params: BinParams } {
  if (payload !== null && typeof payload === 'object' && 'params' in payload) {
    const { name, params } = payload as { name?: unknown; params: unknown };
    if (typeof params === 'object' && params !== null) {
      // Empty/whitespace-only remote names become `undefined` so the
      // fallback chain kicks in. The server stores `name = ''` when an
      // older client pushes the legacy bare-params shape; we must not
      // overwrite a real local name with that empty.
      const trimmed = typeof name === 'string' ? name.trim() : '';
      return {
        name: trimmed === '' ? undefined : trimmed,
        params: params as BinParams,
      };
    }
  }
  return { params: payload as BinParams };
}

export const designAdapter: DesignAdapter = {
  async list(): Promise<SyncableItem<DesignSyncPayload>[]> {
    const result = await listDesigns();
    if (!isOk(result)) return [];
    return result.value.map((d) => ({
      id: d.id,
      payload: { name: d.name, params: d.params },
      modifiedAt: toMs(d.updatedAt),
    }));
  },

  async get(id: string): Promise<SyncableItem<DesignSyncPayload> | null> {
    const result = await loadDesign(designId(id));
    if (!isOk(result)) return null;
    const d = result.value;
    return {
      id: d.id,
      payload: { name: d.name, params: d.params },
      modifiedAt: toMs(d.updatedAt),
    };
  },

  async applyRemote(item: SyncableItem<DesignSyncPayload>): Promise<void> {
    suppressed.add(item.id);
    try {
      // Read existing first to preserve local-only fields (thumbnail,
      // exportFileNameConfig) on update.
      const existing = await loadDesign(designId(item.id));
      const base = isOk(existing) ? existing.value : null;
      const { name: remoteName, params } = unwrap(item.payload);
      // LWW: engine only calls applyRemote when remote is newer, so a
      // remote rename must win. Local name is only a fallback for legacy
      // payloads with no name; the literal covers a legacy fresh-device pull.
      const name = remoteName ?? base?.name ?? 'Synced design';
      const result = await saveDesign({
        id: designId(item.id),
        name,
        params,
        thumbnail: base?.thumbnail ?? null,
        exportFileNameConfig: base?.exportFileNameConfig ?? null,
      });
      if (!isOk(result)) {
        throw new Error(`saveDesign failed for ${item.id}`);
      }
    } finally {
      suppressed.delete(item.id);
    }
  },

  async applyRemoteDelete(id: string): Promise<void> {
    suppressed.add(id);
    try {
      const result = await deleteDesign(designId(id));
      if (!isOk(result) && result.error.code !== 'STORAGE_NOT_FOUND') {
        throw new Error(`deleteDesign failed for ${id}`);
      }
    } finally {
      suppressed.delete(id);
    }
  },

  subscribe(listener: AdapterChangeListener): () => void {
    return subscribeDesignerEvents((event) => {
      if (suppressed.has(event.id)) return;
      const change: AdapterChange =
        event.type === 'put'
          ? { kind: 'put', id: event.id, modifiedAt: toMs(event.updatedAt) }
          : { kind: 'delete', id: event.id, modifiedAt: toMs(event.deletedAt) };
      listener(change);
    });
  },
};
