import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  DesignVersionAdapter,
  DesignVersionPayload,
  SyncableItem,
} from '@/core/sync/adapters/types';
import { compressString, decompressString } from '@/shared/utils/compression';
import type { DesignVersion, DesignVersionOrigin } from '@/features/bin-designer/types';
import { designId } from '@/core/types';
import {
  listAllDesignVersions,
  getDesignVersionRecord,
  putRemoteDesignVersion,
  deleteRemoteDesignVersion,
} from '@/features/bin-designer/storage/DesignVersionService';
import { subscribe as subscribeVersionEvents } from './designVersionEvents';

// Lives in features/ for the same reason `designAdapter` does: the record type
// is feature-internal and core/ cannot import it.
//
// The compressed body is the LOCAL representation only. On the wire `content`
// travels as a plain object so the server can run the designer validator over
// it, which it cannot do with an opaque LZ string.

const ORIGINS: readonly DesignVersionOrigin[] = ['manual', 'pre-restore'];

function toOrigin(value: unknown): DesignVersionOrigin {
  return ORIGINS.includes(value as DesignVersionOrigin) ? (value as DesignVersionOrigin) : 'manual';
}

/**
 * A version's mtime is when it was last *edited*, not when it was captured.
 * `engine.sendOne` re-reads the item at push time and sends THIS value, so
 * returning `createdAt` for a renamed version would push the original capture
 * time, lose last-write-wins against the copy already stored, and never
 * converge.
 */
function toMs(version: DesignVersion): number {
  const edited = version.updatedAt === undefined ? NaN : Date.parse(version.updatedAt);
  if (Number.isFinite(edited)) return edited;
  const created = Date.parse(version.createdAt);
  return Number.isFinite(created) ? created : 0;
}

function toItem(version: DesignVersion): SyncableItem<DesignVersionPayload> | null {
  const json = decompressString(version.content);
  // A row whose body will not decompress cannot be validated by the server and
  // would be rejected on every push forever. Skipping it leaves the local copy
  // readable in the history list and keeps the outbox from wedging.
  if (!json) return null;
  let content: unknown;
  try {
    content = JSON.parse(json);
  } catch {
    return null;
  }
  return {
    id: version.id,
    modifiedAt: toMs(version),
    payload: {
      designId: version.designId,
      name: version.name,
      content,
      createdAt: version.createdAt,
      origin: version.origin,
      ...(version.pinned ? { pinned: true } : {}),
    },
  };
}

function fromItem(item: SyncableItem<DesignVersionPayload>): DesignVersion {
  const p = item.payload;
  return {
    id: item.id,
    designId: designId(p.designId),
    name: p.name,
    content: compressString(JSON.stringify(p.content ?? {})),
    // Not synced. A pulled version renders a placeholder until the local
    // thumbnail regenerator fills one in from the params.
    thumbnail: null,
    createdAt: p.createdAt,
    // The envelope's `modifiedAt` IS the edit time the sender reported, so it
    // rehydrates `updatedAt` without a second wire field. Without this a pulled
    // rename would report `createdAt` as its mtime on the next push and the two
    // devices would trade stale writes forever.
    updatedAt: new Date(item.modifiedAt).toISOString(),
    origin: toOrigin(p.origin),
    ...(p.pinned ? { pinned: true } : {}),
  };
}

export const designVersionAdapter: DesignVersionAdapter = {
  async list(): Promise<SyncableItem<DesignVersionPayload>[]> {
    const result = await listAllDesignVersions();
    if (!isOk(result)) return [];
    return result.value
      .map(toItem)
      .filter((item): item is SyncableItem<DesignVersionPayload> => item !== null);
  },

  async get(id: string): Promise<SyncableItem<DesignVersionPayload> | null> {
    const result = await getDesignVersionRecord(id);
    if (!isOk(result) || result.value === null) return null;
    return toItem(result.value);
  },

  async applyRemote(item: SyncableItem<DesignVersionPayload>): Promise<void> {
    await putRemoteDesignVersion(fromItem(item));
  },

  async applyRemoteDelete(id: string): Promise<void> {
    await deleteRemoteDesignVersion(id);
  },

  subscribe(listener: AdapterChangeListener): () => void {
    return subscribeVersionEvents((event) => {
      const change: AdapterChange =
        event.type === 'put'
          ? { kind: 'put', id: event.id, modifiedAt: event.modifiedAt }
          : { kind: 'delete', id: event.id, modifiedAt: event.deletedAt };
      listener(change);
    });
  },
};
