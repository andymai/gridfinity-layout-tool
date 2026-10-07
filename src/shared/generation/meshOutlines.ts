/**
 * Outline rings of the mesh files this thread has read, by hash.
 *
 * Silhouettes are read synchronously all over the editor and the generation
 * pipeline, and a ref carries none of its own. Each thread fills its copy as
 * files arrive (the main thread from the mesh store, the worker from the
 * bridge), so a ref whose file is not here yet reads as pending rather than
 * as missing.
 */

import { isMeshAssetRef } from './meshAsset';
import type { MeshAssetEntry, MeshOutlinePoint } from './meshAsset';

const outlinesByHash = new Map<string, MeshOutlinePoint[][]>();
const listeners = new Set<() => void>();
let revision = 0;

function notify(): void {
  revision++;
  for (const listener of listeners) listener();
}

/** A hash names its content, so outlines already held for it are never replaced. */
export function setMeshOutlines(hash: string, outlines: MeshOutlinePoint[][]): void {
  if (outlinesByHash.has(hash)) return;
  outlinesByHash.set(hash, outlines);
  notify();
}

export function deleteMeshOutlines(hash: string): void {
  if (outlinesByHash.delete(hash)) notify();
}

export function hasMeshOutlines(hash: string): boolean {
  return outlinesByHash.has(hash);
}

/** The entry's outline rings, or undefined while a ref's file is not on this thread. */
export function meshAssetOutlines(
  entry: MeshAssetEntry | undefined
): MeshOutlinePoint[][] | undefined {
  if (!entry) return undefined;
  return isMeshAssetRef(entry) ? outlinesByHash.get(entry.hash) : entry.outlines;
}

export function subscribeMeshOutlines(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Moves whenever an outline arrives or leaves; the `useSyncExternalStore` snapshot. */
export function meshOutlinesRevision(): number {
  return revision;
}

/** Test-only. */
export function __clearMeshOutlinesForTests(): void {
  outlinesByHash.clear();
  notify();
}
