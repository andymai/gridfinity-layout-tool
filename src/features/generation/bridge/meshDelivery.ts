/**
 * Mesh files for the generation worker. Requests carry refs, never mesh bytes:
 * each file goes to a worker once (PUT_MESH, transferred) and is named by its
 * hash after that, so an edit structured-clones no mesh into the worker, and
 * the worker's caches key on the hash.
 */

import { err, isErr, ok, storageMeshMissing } from '@/core/result';
import type { Result, StorageMeshMissingError } from '@/core/result';
import { isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { MeshAssetEntry } from '@/shared/generation/meshAsset';
import { meshAssetFile } from '@/shared/generation/meshRefs';
import { getMeshFile } from '@/shared/generation/meshStore';
import type { BinParams } from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type { DropMeshMessage, PutMeshMessage, WorkerMessage } from './types';

/** Per worker. Past it, the files least recently needed are dropped. */
export const MESH_DELIVERY_MAX_BYTES = 32 * 1024 * 1024;

type BinParamsMessage = Extract<
  WorkerMessage,
  { readonly payload: { readonly params: BinParams } }
>;
type ItemMessage = Extract<WorkerMessage, { readonly payload: { readonly item: GridfinityItem } }>;

const BIN_PARAMS_MESSAGES: Record<BinParamsMessage['type'], true> = {
  GENERATE: true,
  ESTIMATE: true,
  WARM: true,
  GENERATE_SPLIT_PREVIEW: true,
  GENERATE_SPLIT_PREVIEW_RANGE: true,
  EXPORT: true,
  EXPORT_DIVIDERS: true,
  EXPORT_COMBINED: true,
  EXPORT_SPLIT: true,
  EXPORT_SPLIT_RANGE: true,
  EXPORT_FIT_TEST: true,
};

const ITEM_MESSAGES: Record<ItemMessage['type'], true> = {
  GENERATE_ITEM: true,
  EXPORT_ITEM: true,
};

function carriesBinParams(message: WorkerMessage): message is BinParamsMessage {
  return message.type in BIN_PARAMS_MESSAGES;
}

function carriesItem(message: WorkerMessage): message is ItemMessage {
  return message.type in ITEM_MESSAGES;
}

export class MeshUnavailableError extends Error {
  constructor() {
    super('A mesh this design uses is not on this device yet');
    this.name = 'MeshUnavailableError';
  }
}

export interface PreparedMeshes {
  /** Every file the request's refs name. */
  readonly files: ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
  /**
   * A ref's file is not on this device, so the cutouts using it were left out:
   * fine for a preview that says so, never for an export.
   */
  readonly pending: boolean;
  /** A request built from the same params or item, as the worker gets it. */
  readonly apply: (message: WorkerMessage) => WorkerMessage;
}

type Files = Map<string, Uint8Array<ArrayBuffer>>;

const unchanged = (message: WorkerMessage): WorkerMessage => message;

async function deliverable(
  entry: MeshAssetEntry,
  files: Files
): Promise<Result<MeshAssetEntry, StorageMeshMissingError>> {
  if (isMeshAssetRef(entry)) {
    const bytes = await getMeshFile(entry.hash);
    if (!bytes) return err(storageMeshMissing(entry.hash));
    files.set(entry.hash, bytes);
    return ok(entry);
  }
  // An asset the file format cannot hold goes inline, as it is stored.
  const file = await meshAssetFile(entry);
  if (!file) return ok(entry);
  files.set(file.ref.hash, file.bytes);
  return ok(file.ref);
}

async function prepareParams(
  params: BinParams,
  files: Files
): Promise<{ params: BinParams; pending: boolean }> {
  const assets = params.meshAssets;
  if (!assets) return { params, pending: false };
  const next: Record<string, MeshAssetEntry> = {};
  const pendingIds = new Set<string>();
  let changed = false;
  for (const [id, entry] of Object.entries(assets)) {
    const sent = await deliverable(entry, files);
    if (isErr(sent)) pendingIds.add(id);
    else next[id] = sent.value;
    if (isErr(sent) || sent.value !== entry) changed = true;
  }
  if (!changed) return { params, pending: false };
  const cutouts =
    pendingIds.size === 0
      ? params.cutouts
      : params.cutouts.filter((c) => c.shape !== 'mesh' || !pendingIds.has(c.meshId ?? ''));
  return { params: { ...params, meshAssets: next, cutouts }, pending: pendingIds.size > 0 };
}

/**
 * Swap a request's inline assets for refs and gather the files those refs
 * name. Fails for an imported STL design whose file is missing, since the mesh
 * is all there is to build.
 */
export async function prepareMeshes(
  message: WorkerMessage
): Promise<Result<PreparedMeshes, StorageMeshMissingError>> {
  const files: Files = new Map();
  if (carriesBinParams(message)) {
    const prepared = await prepareParams(message.payload.params, files);
    const apply =
      prepared.params === message.payload.params
        ? unchanged
        : (m: WorkerMessage): WorkerMessage =>
            carriesBinParams(m)
              ? ({ ...m, payload: { ...m.payload, params: prepared.params } } as WorkerMessage)
              : m;
    return ok({ files, pending: prepared.pending, apply });
  }
  if (carriesItem(message)) {
    const { item } = message.payload;
    const structure = item.structure;
    if (structure.kind !== 'importedMesh') return ok({ files, pending: false, apply: unchanged });
    const delivered = await deliverable(structure.asset, files);
    if (isErr(delivered)) return delivered;
    const sent = delivered.value;
    const sentItem: GridfinityItem = { ...item, structure: { ...structure, asset: sent } };
    const apply =
      sent === structure.asset
        ? unchanged
        : (m: WorkerMessage): WorkerMessage =>
            carriesItem(m)
              ? ({ ...m, payload: { ...m.payload, item: sentItem } } as WorkerMessage)
              : m;
    return ok({ files, pending: false, apply });
  }
  return ok({ files, pending: false, apply: unchanged });
}

/** Which files one worker holds, so each is sent once and the total stays bounded. */
export class MeshDelivery {
  /** Insertion order is recency order. */
  private readonly held = new Map<string, number>();
  private heldBytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes: number = MESH_DELIVERY_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  /** The worker was replaced and holds nothing. */
  reset(): void {
    this.held.clear();
    this.heldBytes = 0;
  }

  /**
   * What to post ahead of a request needing `files`: each file the worker lacks
   * (a copy, transferred), then drops for the least recently needed files past
   * the budget. A file the request needs is never dropped.
   */
  messagesFor(
    files: ReadonlyMap<string, Uint8Array<ArrayBuffer>>
  ): { message: PutMeshMessage | DropMeshMessage; transfer: Transferable[] }[] {
    const out: { message: PutMeshMessage | DropMeshMessage; transfer: Transferable[] }[] = [];
    for (const [hash, bytes] of files) {
      const size = this.held.get(hash);
      this.held.delete(hash);
      this.held.set(hash, bytes.byteLength);
      if (size !== undefined) continue;
      this.heldBytes += bytes.byteLength;
      const copy = bytes.slice();
      out.push({ message: { type: 'PUT_MESH', hash, bytes: copy }, transfer: [copy.buffer] });
    }
    for (const [hash, size] of this.held) {
      if (this.heldBytes <= this.maxBytes) break;
      if (files.has(hash)) continue;
      this.held.delete(hash);
      this.heldBytes -= size;
      out.push({ message: { type: 'DROP_MESH', hash }, transfer: [] });
    }
    return out;
  }
}
