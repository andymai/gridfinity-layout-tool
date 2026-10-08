/**
 * Outline rings of the mesh files this thread has read, by hash.
 *
 * Silhouettes are read synchronously all over the editor and the generation
 * pipeline, and a ref carries none of its own. Each thread fills its copy as
 * files arrive (the main thread from the mesh store, the worker from the
 * bridge), so a ref whose file is not here yet reads as pending rather than
 * as missing.
 *
 * Outlines in use are held (by a mounted editor view, or by the worker for a
 * file it keeps) and never let go; of the rest only the most recent
 * {@link MAX_UNHELD_OUTLINES} stay.
 */

import { isMeshAssetRef } from './meshAsset';
import type { MeshAssetEntry, MeshOutlinePoint } from './meshAsset';

/** Insertion order is recency order. */
const outlinesByHash = new Map<string, MeshOutlinePoint[][]>();
const holds = new Map<string, number>();
const listeners = new Set<() => void>();
let revision = 0;

export const MAX_UNHELD_OUTLINES = 64;

function trimUnheld(): void {
  let unheld = 0;
  for (const hash of outlinesByHash.keys()) if (!holds.has(hash)) unheld++;
  for (const hash of outlinesByHash.keys()) {
    if (unheld <= MAX_UNHELD_OUTLINES) return;
    if (holds.has(hash)) continue;
    outlinesByHash.delete(hash);
    unheld--;
  }
}

/** Keep these hashes' outlines while held; the returned function lets go. */
export function holdMeshOutlines(hashes: Iterable<string>): () => void {
  const held = [...hashes];
  for (const hash of held) holds.set(hash, (holds.get(hash) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const hash of held) {
      const count = holds.get(hash) ?? 0;
      if (count <= 1) holds.delete(hash);
      else holds.set(hash, count - 1);
    }
    trimUnheld();
  };
}

function notify(): void {
  revision++;
  for (const listener of listeners) listener();
}

/** A hash names its content, so outlines already held for it are never replaced. */
export function setMeshOutlines(hash: string, outlines: MeshOutlinePoint[][]): void {
  if (outlinesByHash.has(hash)) return;
  outlinesByHash.set(hash, outlines);
  trimUnheld();
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
  holds.clear();
  notify();
}
