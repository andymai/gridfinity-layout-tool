import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  DesignVersionAdapter,
  DesignVersionPayload,
  PushPlan,
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
import { isSyncableDesign } from '@/features/bin-designer/utils/designKind';
import {
  holderMeshHashes,
  inlineHolderMeshes,
  storeHolderMeshes,
} from '@/shared/generation/meshRefs';
import type { MeshHolder } from '@/shared/generation/meshRefs';
import { fetchMeshFiles, forgetHeldMeshes } from '@/shared/generation/meshCloud';
import { subscribe as subscribeVersionEvents } from './designVersionEvents';
import { createMissingMeshPushes } from './missingMeshPushes';
import { planMeshPush } from './meshPushPlan';

const missingMeshPushes = createMissingMeshPushes();

// Lives in features/ for the same reason `designAdapter` does: the record type
// is feature-internal and core/ cannot import it.
//
// The compressed body is the LOCAL representation only. On the wire `content`
// travels as a plain object so the server can run the designer validator over
// it, which it cannot do with an opaque LZ string. Its meshes travel as they do
// for a design: refs once the account holds the files, inline otherwise.

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

function readContent(version: DesignVersion): MeshHolder | null {
  const json = decompressString(version.content);
  // A row whose body will not decompress cannot be validated by the server and
  // would be rejected on every push forever. Skipping it leaves the local copy
  // readable in the history list and keeps the outbox from wedging.
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    // Keyed off the content rather than the owning design: the content is what
    // the server validates, and it records the kind it was captured as.
    return typeof parsed === 'object' && parsed !== null && isSyncableDesign(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function toItem(version: DesignVersion, content: MeshHolder): SyncableItem<DesignVersionPayload> {
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

async function fromItem(item: SyncableItem<DesignVersionPayload>): Promise<DesignVersion> {
  const p = item.payload;
  const content =
    typeof p.content === 'object' && p.content !== null
      ? await storeHolderMeshes(p.content)
      : (p.content ?? {});
  return {
    id: item.id,
    designId: designId(p.designId),
    name: p.name,
    content: compressString(JSON.stringify(content)),
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

async function readVersion(
  id: string
): Promise<{ version: DesignVersion; content: MeshHolder } | null> {
  const result = await getDesignVersionRecord(id);
  const version = isOk(result) ? result.value : null;
  const content = version && readContent(version);
  return version && content ? { version, content } : null;
}

/**
 * The version with its meshes inline (only those naming a hash in `only`, when
 * given), refusing a body whose mesh file is missing rather than push it
 * without the mesh over the copy the server has; the file's arrival queues it
 * again.
 */
async function inlineVersion(
  id: string,
  only?: ReadonlySet<string>
): Promise<SyncableItem<DesignVersionPayload> | null> {
  const read = await readVersion(id);
  if (!read) return null;
  const inline = await inlineHolderMeshes(read.content, only);
  if (!isOk(inline)) {
    missingMeshPushes.skip(inline.error.hash, id);
    return null;
  }
  return toItem(read.version, inline.value);
}

export const designVersionAdapter: DesignVersionAdapter = {
  // Leaves the refs: this runs on every poll, its callers read ids and mtimes
  // only, and sign-out wipes by this list.
  async list(): Promise<SyncableItem<DesignVersionPayload>[]> {
    const result = await listAllDesignVersions();
    if (!isOk(result)) return [];
    return result.value.flatMap((version) => {
      const content = readContent(version);
      return content ? [toItem(version, content)] : [];
    });
  },

  get(id: string): Promise<SyncableItem<DesignVersionPayload> | null> {
    return inlineVersion(id);
  },

  async preparePush(id: string): Promise<PushPlan<DesignVersionPayload>> {
    const read = await readVersion(id);
    if (!read) return { status: 'skip' };
    return planMeshPush(
      toItem(read.version, read.content),
      read.content,
      (only) => inlineVersion(id, only),
      missingMeshPushes
    );
  },

  onMissing: forgetHeldMeshes,

  async applyRemote(item: SyncableItem<DesignVersionPayload>): Promise<void> {
    await putRemoteDesignVersion(await fromItem(item));
    const { content } = item.payload;
    if (typeof content === 'object' && content !== null) {
      void fetchMeshFiles(holderMeshHashes(content));
    }
  },

  async applyRemoteDelete(id: string): Promise<void> {
    await deleteRemoteDesignVersion(id);
  },

  subscribe(listener: AdapterChangeListener): () => void {
    const stopEvents = subscribeVersionEvents((event) => {
      missingMeshPushes.clear(event.id);
      const change: AdapterChange =
        event.type === 'put'
          ? { kind: 'put', id: event.id, modifiedAt: event.modifiedAt }
          : { kind: 'delete', id: event.id, modifiedAt: event.deletedAt };
      listener(change);
    });
    const stopArrivals = missingMeshPushes.subscribe(listener, async (id) => {
      const current = await getDesignVersionRecord(id);
      return isOk(current) && current.value !== null ? toMs(current.value) : null;
    });
    return () => {
      stopEvents();
      stopArrivals();
    };
  },
};
