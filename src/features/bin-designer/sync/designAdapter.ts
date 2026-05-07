import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  DesignAdapter,
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

const suppressed = new Set<string>();

function suppress(id: string): void {
  suppressed.add(id);
  queueMicrotask(() => {
    suppressed.delete(id);
  });
}

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export const designAdapter: DesignAdapter = {
  async list(): Promise<SyncableItem<BinParams>[]> {
    const result = await listDesigns();
    if (!isOk(result)) return [];
    return result.value.map((d) => ({
      id: d.id,
      payload: d.params,
      modifiedAt: toMs(d.updatedAt),
    }));
  },

  async get(id: string): Promise<SyncableItem<BinParams> | null> {
    const result = await loadDesign(designId(id));
    if (!isOk(result)) return null;
    const d = result.value;
    return { id: d.id, payload: d.params, modifiedAt: toMs(d.updatedAt) };
  },

  async applyRemote(item: SyncableItem<BinParams>): Promise<void> {
    suppress(item.id);
    // Read the existing design first to preserve local-only fields
    // (thumbnail, exportFileNameConfig) on update.
    const existing = await loadDesign(designId(item.id));
    const base = isOk(existing) ? existing.value : null;
    const result = await saveDesign({
      id: designId(item.id),
      name: base?.name ?? 'Synced design',
      params: item.payload,
      thumbnail: base?.thumbnail ?? null,
      exportFileNameConfig: base?.exportFileNameConfig ?? null,
    });
    if (!isOk(result)) {
      throw new Error(`saveDesign failed for ${item.id}`);
    }
  },

  async applyRemoteDelete(id: string): Promise<void> {
    suppress(id);
    const result = await deleteDesign(designId(id));
    if (!isOk(result) && result.error.code !== 'STORAGE_NOT_FOUND') {
      throw new Error(`deleteDesign failed for ${id}`);
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
