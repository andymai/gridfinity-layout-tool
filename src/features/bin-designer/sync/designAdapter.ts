import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  DesignAdapter,
  DesignSyncPayload,
  PushPlan,
  SyncableItem,
} from '@/core/sync/adapters/types';
import { designId } from '@/core/types';
import type { CommunityDesignLineage } from '@/shared/types/community';
import type { BinParams, SavedDesign } from '@/features/bin-designer/types';
import type { ItemEnvelope } from '@/shared/types/item';
import { assemblyDescriptor } from '@/shared/items/assembly/descriptor';
import { importedMeshSchema } from '@/shared/items/importedMesh/descriptor';
import {
  deleteDesign,
  detachVariant,
  listDesigns,
  loadDesign,
  saveDesign,
} from '@/features/bin-designer/storage/DesignerStorage';
import { isBinDesign, isSyncableDesign } from '@/features/bin-designer/utils/designKind';
import {
  registryItemEntry,
  upsertRegistryEntry,
} from '@/features/bin-designer/store/customBinRegistry';
import { normalizeTags } from '@/features/bin-designer/utils/tags';
import { syncPersistError } from '@/core/sync/adapters/persistError';
import { holderMeshHashes, inlineHolderMeshes } from '@/shared/generation/meshRefs';
import {
  endMeshCloudSession,
  fetchMeshFiles,
  forgetHeldMeshes,
  meshCloudSession,
} from '@/shared/generation/meshCloud';
import { referencedMeshHashes } from '@/features/bin-designer/storage/designMeshFiles';
import { subscribe as subscribeDesignerEvents } from './designerEvents';
import { createMissingMeshPushes } from './missingMeshPushes';
import { planMeshPush } from './meshPushPlan';

// Lives in features/ because BinParams is feature-internal; core/ can't
// import it. Registered with the engine at app-shell boot.
//
// SavedDesign stores `updatedAt` as ISO; the cloud envelope is ms. We
// normalize at this boundary so the engine never sees ISO strings.
//
// A design's meshes are refs into the mesh store. A push sends the refs once
// the account holds every file, or inline meshes (`get()`) to a server without
// a mesh store. `saveDesign` turns a pulled payload's inline meshes into refs.

// Held across the full `saveDesign`/`deleteDesign` await chain because
// the `emit()` that needs suppression fires past internal await boundaries;
// a microtask cleanup would release too early.
const suppressed = new Set<string>();
const missingMeshPushes = createMissingMeshPushes();

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function isLineage(value: unknown): value is CommunityDesignLineage {
  if (value === null || typeof value !== 'object') return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.parentId === 'string' &&
    typeof l.rootId === 'string' &&
    typeof l.parentName === 'string' &&
    typeof l.parentAuthorName === 'string' &&
    typeof l.rootAuthorName === 'string'
  );
}

/**
 * Accept either the new `{ name, params }` wrapper or the legacy bare
 * `BinParams` shape so pre-name cloud blobs still apply cleanly.
 */
function unwrap(payload: unknown): {
  name?: string;
  params?: BinParams;
  kind?: 'assembly' | 'importedMesh';
  envelope?: ItemEnvelope;
  structure?: unknown;
  tags?: string[];
  publishedId?: string | null;
  lineage?: CommunityDesignLineage | null;
  /** A kind-wrapped payload this client cannot represent — do not apply. */
  invalid?: true;
} {
  if (payload !== null && typeof payload === 'object' && 'kind' in payload) {
    const wrapper = payload as {
      name?: unknown;
      kind?: unknown;
      envelope?: unknown;
      structure?: unknown;
      tags?: unknown;
      publishedId?: unknown;
      lineage?: unknown;
    };
    const kind = wrapper.kind;
    if (
      (kind === 'assembly' || kind === 'importedMesh') &&
      typeof wrapper.envelope === 'object' &&
      wrapper.envelope !== null &&
      typeof wrapper.structure === 'object' &&
      wrapper.structure !== null
    ) {
      const trimmed = typeof wrapper.name === 'string' ? wrapper.name.trim() : '';
      return {
        name: trimmed === '' ? undefined : trimmed,
        kind,
        envelope: wrapper.envelope as ItemEnvelope,
        structure: wrapper.structure,
        tags: wrapper.tags === undefined ? undefined : normalizeTags(wrapper.tags),
        publishedId:
          wrapper.publishedId === null || typeof wrapper.publishedId === 'string'
            ? wrapper.publishedId
            : undefined,
        lineage:
          wrapper.lineage === null
            ? null
            : isLineage(wrapper.lineage)
              ? wrapper.lineage
              : undefined,
      };
    }
    // Any other kind-wrapped payload (a future kind, or a wrapper missing its
    // envelope/structure) must not fall through to the bare
    // BinParams path — that would persist a corrupted bin row.
    return { invalid: true };
  }
  if (payload !== null && typeof payload === 'object' && 'params' in payload) {
    const { name, params, tags, publishedId, lineage } = payload as {
      name?: unknown;
      params: unknown;
      tags?: unknown;
      publishedId?: unknown;
      lineage?: unknown;
    };
    if (typeof params === 'object' && params !== null) {
      // Empty/whitespace-only remote names become `undefined` so the
      // fallback chain kicks in. The server stores `name = ''` when an
      // older client pushes the legacy bare-params shape; we must not
      // overwrite a real local name with that empty.
      const trimmed = typeof name === 'string' ? name.trim() : '';
      // `undefined` (legacy payload with no tags field) lets the local
      // fallback win; an explicit array (even empty) is authoritative.
      const normalizedTags = tags === undefined ? undefined : normalizeTags(tags);
      return {
        name: trimmed === '' ? undefined : trimmed,
        params: params as BinParams,
        tags: normalizedTags,
        // Explicit `null` is authoritative (unpublished / no lineage);
        // malformed values degrade to `undefined` so local state survives.
        publishedId:
          publishedId === null || typeof publishedId === 'string' ? publishedId : undefined,
        lineage: lineage === null ? null : isLineage(lineage) ? lineage : undefined,
      };
    }
  }
  return { params: payload as BinParams };
}

type PulledContent = Pick<SavedDesign, 'kind' | 'params' | 'envelope' | 'structure'>;

/**
 * The kind-specific half of a pulled design, or null when this client cannot
 * represent it. An assembly's migration drops a newer client's unknown fields
 * node by node rather than reject them. An imported mesh is checked against its
 * schema instead: the descriptor's migration falls back to a placeholder, which
 * would take the place of the mesh in the stored copy.
 */
function pulledContent(pulled: ReturnType<typeof unwrap>): PulledContent | null {
  const { kind, envelope, structure, params } = pulled;
  if (kind === undefined) return { params };
  if (!envelope) return null;
  if (kind === 'assembly') {
    return { kind, envelope, structure: assemblyDescriptor.migrate(structure, envelope) };
  }
  const parsed = importedMeshSchema.safeParse(structure);
  return parsed.success ? { kind, envelope, structure: parsed.data } : null;
}

/**
 * Spread conditionally rather than assigned: an explicit `undefined` key hashes
 * like `null` in the server's equal-ms tiebreaker, which would make an
 * unbranched design compare differently from one that predates the field.
 */
function branchFields(d: SavedDesign) {
  return {
    ...(d.parentDesignId !== undefined ? { parentDesignId: String(d.parentDesignId) } : {}),
    ...(d.parentVersionId !== undefined ? { parentVersionId: d.parentVersionId } : {}),
    ...(d.parentVersionName !== undefined ? { parentVersionName: d.parentVersionName } : {}),
    ...(d.variantOf !== undefined ? { variantOf: String(d.variantOf) } : {}),
    ...(d.overrides !== undefined ? { overrides: d.overrides } : {}),
  };
}

function buildPayload(d: SavedDesign): DesignSyncPayload {
  if (isBinDesign(d)) {
    return {
      name: d.name,
      params: d.params,
      tags: d.tags,
      publishedId: d.publishedId,
      lineage: d.lineage,
      ...branchFields(d),
    };
  }
  return {
    name: d.name,
    kind: d.kind,
    envelope: d.envelope,
    structure: d.structure,
    tags: d.tags,
    publishedId: d.publishedId,
    lineage: d.lineage,
    ...branchFields(d),
  };
}

function toItem(d: SavedDesign): SyncableItem<DesignSyncPayload> {
  return { id: d.id, payload: buildPayload(d), modifiedAt: toMs(d.updatedAt) };
}

/**
 * The design with its meshes inline (only those naming a hash in `only`, when
 * given). Non-syncable kinds answer null, which makes the engine drop the
 * outbox entry as a no-op (it never tombstones on a null get). A design whose
 * mesh file is missing is dropped the same way, so the copy on the server keeps
 * its mesh, and queued again when the file arrives.
 */
async function inlineDesign(
  id: string,
  only?: ReadonlySet<string>
): Promise<SyncableItem<DesignSyncPayload> | null> {
  const result = await loadDesign(designId(id));
  if (!isOk(result) || !isSyncableDesign(result.value)) return null;
  const inline = await inlineHolderMeshes(result.value, only);
  if (!isOk(inline)) {
    missingMeshPushes.skip(inline.error.hash, id);
    return null;
  }
  return toItem(inline.value);
}

export const designAdapter: DesignAdapter = {
  async list(): Promise<SyncableItem<DesignSyncPayload>[]> {
    const result = await listDesigns();
    if (!isOk(result)) return [];
    // Meshes stay refs: every caller reads ids and mtimes only, and this runs
    // on every poll.
    return result.value.filter(isSyncableDesign).map(toItem);
  },

  get(id: string): Promise<SyncableItem<DesignSyncPayload> | null> {
    return inlineDesign(id);
  },

  async preparePush(id: string): Promise<PushPlan<DesignSyncPayload>> {
    const session = meshCloudSession();
    const result = await loadDesign(designId(id));
    if (!isOk(result) || !isSyncableDesign(result.value)) return { status: 'skip' };
    return planMeshPush(
      toItem(result.value),
      result.value,
      (only) => inlineDesign(id, only),
      missingMeshPushes,
      session
    );
  },

  onMissing: forgetHeldMeshes,

  async applyRemote(item: SyncableItem<DesignSyncPayload>): Promise<void> {
    const session = meshCloudSession();
    suppressed.add(item.id);
    try {
      // Read existing first to preserve local-only fields (thumbnail,
      // exportFileNameConfig) on update.
      const existing = await loadDesign(designId(item.id));
      const base = isOk(existing) ? existing.value : null;
      const pulled = unwrap(item.payload);
      const content = pulled.invalid ? null : pulledContent(pulled);
      if (!content) return;
      const {
        name: remoteName,
        tags: remoteTags,
        publishedId: remotePublishedId,
        lineage: remoteLineage,
      } = pulled;
      // LWW: engine only calls applyRemote when remote is newer, so a
      // remote rename must win. Local name is only a fallback for legacy
      // payloads with no name; the literal covers a legacy fresh-device pull.
      const name = remoteName ?? base?.name ?? 'Synced design';
      // Same LWW logic for tags: a remote array (even empty) wins; only a
      // legacy payload that omits tags entirely falls back to local.
      const tags = remoteTags ?? base?.tags;
      // `??` would swallow an explicit remote `null` ("unpublished on the
      // other device"), so only `undefined` (legacy payload) falls back.
      const publishedId = remotePublishedId === undefined ? base?.publishedId : remotePublishedId;
      const lineage = remoteLineage === undefined ? base?.lineage : remoteLineage;
      const remote = item.payload;
      // Branch lineage is written once and never cleared, so an absent remote
      // value there really does mean "this payload predates the field".
      //
      // The VARIANT pair is different: it is current state, and detaching
      // clears both. Falling back to the local value would make a detach
      // unsyncable, so remote wins outright — the engine only calls this when
      // remote is newer. `overrides` defaults to `{}` rather than `undefined`
      // so releasing every claim also crosses the wire (the server drops an
      // empty object, which would otherwise read as "keep what you have").
      const variantOf = remote.variantOf ? designId(remote.variantOf) : undefined;
      const branch = {
        parentDesignId: remote.parentDesignId
          ? designId(remote.parentDesignId)
          : base?.parentDesignId,
        parentVersionId: remote.parentVersionId ?? base?.parentVersionId,
        parentVersionName: remote.parentVersionName ?? base?.parentVersionName,
        ...(variantOf
          ? { variantOf, overrides: (remote.overrides as SavedDesign['overrides']) ?? {} }
          : {}),
      };
      const result = await saveDesign({
        id: designId(item.id),
        name,
        ...content,
        thumbnail: base?.thumbnail ?? null,
        exportFileNameConfig: base?.exportFileNameConfig ?? null,
        tags,
        publishedId,
        lineage,
        ...branch,
      });
      if (!isOk(result)) {
        throw syncPersistError('saveDesign', item.id, result.error);
      }
      void fetchMeshFiles(holderMeshHashes(result.value), session);
      // saveDesign never registers, and the startup pass that backfills
      // entries runs once per page load, so a Workshop design pulled
      // mid-session would read as a parametric bin, and an imported mesh would
      // be missing from the layout's palette, until the next reload.
      const registryEntry = registryItemEntry(result.value);
      if (registryEntry) upsertRegistryEntry(registryEntry);
      // `saveDesign` falls back to the STORED value for both variant fields, so
      // it cannot clear them; `detachVariant` writes through the store for
      // exactly that reason. Runs after the save so it keeps what was just
      // written.
      if (!variantOf && base?.variantOf) {
        await detachVariant(designId(item.id));
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
        throw syncPersistError('deleteDesign', id, result.error);
      }
    } finally {
      suppressed.delete(id);
    }
  },

  subscribe(listener: AdapterChangeListener): () => void {
    // The engine subscribes once a signed-in session starts: the moment to try
    // again for files a pull could not fetch (offline, say) on an earlier page.
    const session = meshCloudSession();
    void referencedMeshHashes()
      .then((hashes) => fetchMeshFiles([...hashes], session))
      .catch(() => undefined);
    const stopEvents = subscribeDesignerEvents((event) => {
      missingMeshPushes.clear(event.id);
      if (suppressed.has(event.id)) return;
      const change: AdapterChange =
        event.type === 'put'
          ? { kind: 'put', id: event.id, modifiedAt: toMs(event.updatedAt) }
          : { kind: 'delete', id: event.id, modifiedAt: toMs(event.deletedAt) };
      listener(change);
    });
    const stopArrivals = missingMeshPushes.subscribe(listener, async (id) => {
      const current = await loadDesign(designId(id));
      return isOk(current) ? toMs(current.value.updatedAt) : null;
    });
    return () => {
      stopEvents();
      stopArrivals();
      endMeshCloudSession();
    };
  },
};
