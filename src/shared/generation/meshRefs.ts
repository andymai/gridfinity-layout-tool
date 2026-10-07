/**
 * Moving mesh assets between their inline form and refs into the local mesh
 * store (`meshStore.ts`).
 *
 * Stored designs and versions hold refs, so a mesh is kept once however many
 * records name it. Everything that leaves the device (sync, shares, publish,
 * file exports) is built inline from them, byte for byte what the inline
 * design produced.
 */

import { isErr } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import { bytesToBase64, isMeshAssetRef } from './meshAsset';
import type { MeshAsset, MeshAssetEntry, MeshAssetRef } from './meshAsset';
import { encodeMeshFile, parseMeshFile } from './meshFile';
import { hasMeshOutlines, setMeshOutlines } from './meshOutlines';
import { getMeshFile, putMeshFile } from './meshStore';

export class MeshFileMissingError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super(`Mesh file ${hash} is not on this device`);
    this.name = 'MeshFileMissingError';
    this.hash = hash;
  }
}

/** A design, version body or payload: bin params, or an item structure. */
export interface MeshHolder {
  readonly params?: unknown;
  readonly structure?: unknown;
}

type MeshAssetMap = Readonly<Record<string, MeshAssetEntry>>;

function isEntry(value: unknown): value is MeshAssetEntry {
  return typeof value === 'object' && value !== null;
}

function meshAssetsOf(params: unknown): MeshAssetMap | undefined {
  if (typeof params !== 'object' || params === null) return undefined;
  const assets = (params as { meshAssets?: unknown }).meshAssets;
  return typeof assets === 'object' && assets !== null ? (assets as MeshAssetMap) : undefined;
}

function importedMeshAssetOf(structure: unknown): MeshAssetEntry | undefined {
  if (typeof structure !== 'object' || structure === null) return undefined;
  const { kind, asset } = structure as { kind?: unknown; asset?: unknown };
  return kind === 'importedMesh' && isEntry(asset) ? asset : undefined;
}

const storing = new WeakMap<MeshAsset, Promise<MeshAssetRef | null>>();

async function writeMeshAsset(asset: MeshAsset): Promise<MeshAssetRef | null> {
  const file = encodeMeshFile(asset);
  if (isErr(file)) return null;
  const hash = await putMeshFile(file.value);
  if (hash === null) return null;
  setMeshOutlines(hash, asset.outlines);
  return {
    name: asset.name,
    hash,
    triangleCount: asset.triangleCount,
    sizeMm: asset.sizeMm,
    bytes: file.value.byteLength,
  };
}

/**
 * Store an inline asset's file and answer its ref, or null when the file could
 * not be written, in which case the caller keeps the asset inline.
 */
export function storeMeshAsset(asset: MeshAsset): Promise<MeshAssetRef | null> {
  const known = storing.get(asset);
  if (known) return known;
  const pending = writeMeshAsset(asset).catch(() => null);
  storing.set(asset, pending);
  void pending.then((ref) => {
    if (ref === null) storing.delete(asset);
  });
  return pending;
}

/** The inline form of an entry, or null when a ref's file is not on this device. */
export async function resolveMeshAsset(entry: MeshAssetEntry): Promise<MeshAsset | null> {
  if (!isMeshAssetRef(entry)) return entry;
  const bytes = await getMeshFile(entry.hash);
  if (!bytes) return null;
  const parsed = parseMeshFile(bytes);
  if (isErr(parsed)) return null;
  setMeshOutlines(entry.hash, parsed.value.outlines);
  return {
    name: entry.name,
    data: bytesToBase64(parsed.value.geometry),
    triangleCount: entry.triangleCount,
    sizeMm: entry.sizeMm,
    outlines: parsed.value.outlines,
  };
}

async function mapAssets(
  assets: MeshAssetMap,
  convert: (entry: MeshAssetEntry) => Promise<MeshAssetEntry>
): Promise<Record<string, MeshAssetEntry> | null> {
  let changed = false;
  const next: Record<string, MeshAssetEntry> = {};
  for (const [id, entry] of Object.entries(assets)) {
    next[id] = isEntry(entry) ? await convert(entry) : entry;
    if (next[id] !== entry) changed = true;
  }
  return changed ? next : null;
}

async function mapHolder<T extends MeshHolder>(
  holder: T,
  convert: (entry: MeshAssetEntry) => Promise<MeshAssetEntry>
): Promise<T> {
  let result = holder;
  const assets = meshAssetsOf(holder.params);
  const nextAssets = assets ? await mapAssets(assets, convert) : null;
  if (nextAssets) {
    result = { ...result, params: { ...(holder.params as BinParams), meshAssets: nextAssets } };
  }
  const asset = importedMeshAssetOf(holder.structure);
  const nextAsset = asset ? await convert(asset) : asset;
  if (nextAsset !== asset) {
    result = { ...result, structure: { ...(holder.structure as object), asset: nextAsset } };
  }
  return result;
}

/**
 * Store every inline asset in `holder` and swap in its ref. Idempotent, and an
 * asset whose file cannot be written stays inline, so nothing is lost. Answers
 * `holder` itself when nothing changed.
 */
export function storeHolderMeshes<T extends MeshHolder>(holder: T): Promise<T> {
  return mapHolder(holder, async (entry) =>
    isMeshAssetRef(entry) ? entry : ((await storeMeshAsset(entry)) ?? entry)
  );
}

/**
 * Swap every ref in `holder` for its inline asset. Throws
 * {@link MeshFileMissingError} when a ref's file is not on this device: a
 * payload missing a mesh must not go out in place of the one that has it.
 */
export function inlineHolderMeshes<T extends MeshHolder>(holder: T): Promise<T> {
  return mapHolder(holder, async (entry) => {
    if (!isMeshAssetRef(entry)) return entry;
    const asset = await resolveMeshAsset(entry);
    if (!asset) throw new MeshFileMissingError(entry.hash);
    return asset;
  });
}

/** {@link inlineHolderMeshes} for bare bin params. */
export async function inlineParamsMeshes(params: BinParams): Promise<BinParams> {
  return (await inlineHolderMeshes({ params })).params;
}

/** The hash of every ref `holder` holds. */
export function holderMeshHashes(holder: MeshHolder): string[] {
  const entries = [
    ...Object.values(meshAssetsOf(holder.params) ?? {}),
    importedMeshAssetOf(holder.structure),
  ];
  return entries.flatMap((e) => (isEntry(e) && isMeshAssetRef(e) ? [e.hash] : []));
}

const loadingOutlines = new Set<string>();

/** Read the outlines of every ref not yet on this thread; a file this device lacks stays pending. */
export async function loadMeshOutlines(entries: Iterable<MeshAssetEntry>): Promise<void> {
  const wanted = [...entries].filter(
    (e): e is MeshAssetRef =>
      isEntry(e) && isMeshAssetRef(e) && !hasMeshOutlines(e.hash) && !loadingOutlines.has(e.hash)
  );
  await Promise.all(
    wanted.map(async ({ hash }) => {
      loadingOutlines.add(hash);
      try {
        const bytes = await getMeshFile(hash);
        const parsed = bytes ? parseMeshFile(bytes) : null;
        if (parsed && !isErr(parsed)) setMeshOutlines(hash, parsed.value.outlines);
      } finally {
        loadingOutlines.delete(hash);
      }
    })
  );
}
