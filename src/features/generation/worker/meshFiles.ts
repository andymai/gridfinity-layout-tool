/**
 * Mesh files the bridge has sent this worker, by hash. Each file's outlines go
 * into the shared outline registry, so a ref reads the same here as on the main
 * thread, and a ref whose file was never sent reads as pending.
 *
 * A drop that lands while a request is being handled waits until the worker is
 * idle: handlers await between reading a file's geometry and its outlines.
 */

import { isErr } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';
import { decodeMeshBytes, decodeMeshData, isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { DecodedMeshData, MeshAssetEntry } from '@/shared/generation/meshAsset';
import { parseMeshFile } from '@/shared/generation/meshFile';
import {
  deleteMeshOutlines,
  holdMeshOutlines,
  setMeshOutlines,
} from '@/shared/generation/meshOutlines';

const geometryByHash = new Map<string, Uint8Array>();
const outlineHolds = new Map<string, () => void>();
const deferredDrops = new Set<string>();
let activeRequests = 0;

function forget(hash: string): void {
  geometryByHash.delete(hash);
  outlineHolds.get(hash)?.();
  outlineHolds.delete(hash);
  deleteMeshOutlines(hash);
}

/** Keep a file the bridge sent. A file that does not parse is ignored and its refs stay pending. */
export function receiveMeshFile(hash: string, bytes: Uint8Array): void {
  const parsed = parseMeshFile(bytes);
  if (isErr(parsed)) return;
  deferredDrops.delete(hash);
  geometryByHash.set(hash, parsed.value.geometry);
  if (!outlineHolds.has(hash)) outlineHolds.set(hash, holdMeshOutlines([hash]));
  setMeshOutlines(hash, parsed.value.outlines);
}

export function dropMeshFile(hash: string): void {
  if (activeRequests > 0) deferredDrops.add(hash);
  else forget(hash);
}

/** Mark a request in progress; the returned function ends it. */
export function beginMeshRequest(): () => void {
  activeRequests++;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeRequests--;
    if (activeRequests > 0) return;
    for (const hash of deferredDrops) forget(hash);
    deferredDrops.clear();
  };
}

/** Test-only. */
export function __clearMeshFilesForTests(): void {
  for (const hash of [...geometryByHash.keys()]) forget(hash);
  deferredDrops.clear();
}

/** Cache key for an entry's geometry: the file hash, or an inline asset's data. */
export function meshEntryKey(entry: MeshAssetEntry): string {
  return isMeshAssetRef(entry) ? entry.hash : entry.data;
}

/** Decode an entry's geometry, or null while a ref's file has not been sent. */
export async function decodeMeshEntry(
  entry: MeshAssetEntry
): Promise<Result<DecodedMeshData, ValidationError> | null> {
  if (!isMeshAssetRef(entry)) return decodeMeshData(entry.data);
  const geometry = geometryByHash.get(entry.hash);
  return geometry ? decodeMeshBytes(geometry) : null;
}
