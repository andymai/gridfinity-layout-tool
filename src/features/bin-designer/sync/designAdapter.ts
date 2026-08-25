import { isOk } from '@/core/result';
import type {
  AdapterChange,
  AdapterChangeListener,
  DesignAdapter,
  DesignSyncPayload,
  SyncableItem,
} from '@/core/sync/adapters/types';
import { designId } from '@/core/types';
import type { CommunityDesignLineage } from '@/shared/types/community';
import type { BinParams, SavedDesign } from '@/features/bin-designer/types';
import type { ItemEnvelope } from '@/shared/types/item';
import { assemblyDescriptor } from '@/shared/items/assembly/descriptor';
import {
  deleteDesign,
  listDesigns,
  loadDesign,
  saveDesign,
} from '@/features/bin-designer/storage/DesignerStorage';
import { isBinDesign, isSyncableDesign } from '@/features/bin-designer/utils/designKind';
import { normalizeTags } from '@/features/bin-designer/utils/tags';
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
  kind?: 'assembly';
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
    if (
      wrapper.kind === 'assembly' &&
      typeof wrapper.envelope === 'object' &&
      wrapper.envelope !== null &&
      typeof wrapper.structure === 'object' &&
      wrapper.structure !== null
    ) {
      const trimmed = typeof wrapper.name === 'string' ? wrapper.name.trim() : '';
      return {
        name: trimmed === '' ? undefined : trimmed,
        kind: 'assembly',
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
    // Any other kind-wrapped payload (a future kind, or an assembly wrapper
    // missing its envelope/structure) must not fall through to the bare
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
    kind: 'assembly',
    envelope: d.envelope,
    structure: d.structure,
    tags: d.tags,
    publishedId: d.publishedId,
    lineage: d.lineage,
    ...branchFields(d),
  };
}

export const designAdapter: DesignAdapter = {
  async list(): Promise<SyncableItem<DesignSyncPayload>[]> {
    const result = await listDesigns();
    if (!isOk(result)) return [];
    // Bins and assemblies sync; toolRack and importedMesh (base64 mesh
    // blobs) stay local-only.
    return result.value.filter(isSyncableDesign).map((d) => ({
      id: d.id,
      payload: buildPayload(d),
      modifiedAt: toMs(d.updatedAt),
    }));
  },

  async get(id: string): Promise<SyncableItem<DesignSyncPayload> | null> {
    const result = await loadDesign(designId(id));
    if (!isOk(result)) return null;
    const d = result.value;
    // Non-syncable kinds: returning null makes the engine drop the outbox
    // entry as a no-op (it never tombstones on a null get).
    if (!isSyncableDesign(d)) return null;
    return {
      id: d.id,
      payload: buildPayload(d),
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
      const {
        name: remoteName,
        params,
        kind: remoteKind,
        envelope: remoteEnvelope,
        structure: remoteStructure,
        tags: remoteTags,
        publishedId: remotePublishedId,
        lineage: remoteLineage,
        invalid,
      } = unwrap(item.payload);
      if (invalid) return;
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
      // Branch lineage is written once and never edited, so an absent remote
      // value means "this payload predates the field", not "detached".
      const remote = item.payload;
      const branch = {
        parentDesignId: remote.parentDesignId
          ? designId(remote.parentDesignId)
          : base?.parentDesignId,
        parentVersionId: remote.parentVersionId ?? base?.parentVersionId,
        parentVersionName: remote.parentVersionName ?? base?.parentVersionName,
        variantOf: remote.variantOf ? designId(remote.variantOf) : base?.variantOf,
        overrides: (remote.overrides as SavedDesign['overrides']) ?? base?.overrides,
      };
      const result =
        remoteKind === 'assembly' && remoteEnvelope
          ? await saveDesign({
              id: designId(item.id),
              name,
              kind: 'assembly',
              envelope: remoteEnvelope,
              // Migration is the gate: a newer client's structure gets its
              // unknown fields dropped node-by-node rather than rejected.
              structure: assemblyDescriptor.migrate(remoteStructure, remoteEnvelope),
              thumbnail: base?.thumbnail ?? null,
              exportFileNameConfig: base?.exportFileNameConfig ?? null,
              tags,
              publishedId,
              lineage,
              ...branch,
            })
          : await saveDesign({
              id: designId(item.id),
              name,
              params: params,
              thumbnail: base?.thumbnail ?? null,
              exportFileNameConfig: base?.exportFileNameConfig ?? null,
              tags,
              publishedId,
              lineage,
              ...branch,
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
