/**
 * Tags every face of `shape` with `tag` via brepjs `setShapeOrigin`. The tag
 * lives in a WeakMap keyed by the shape's wrapped WASM handle and propagates
 * through booleans (fuse/cut) and transforms, so faces in the final solid
 * still report the tag of the input shape that contributed them. Without
 * this call `getFaceOrigins` returns 0 for every face and all colors collapse
 * to one. Read-back happens in `toIndexedMeshData`.
 *
 * `map` is vestigial — kept on the signature so every pipeline call site
 * doesn't have to change. Removing it from `PipelineContext` is a follow-up.
 */

import { getFaceOrigins, getFaces, getHashCode, setShapeOrigin } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { FeatureTag } from '../featureTags';

export function collectOrigins(shape: Shape3D, tag: FeatureTag, _map: Map<number, number>): void {
  setShapeOrigin(shape, tag);
}

/**
 * Drops origin entries for faces `shape` no longer has. Propagation keeps the
 * hash of every input face a boolean did not report as deleted, and a freed
 * face's hash can be reused by a live face of another shape. When this shape
 * is later fused into the bin, its stale entry then overwrites that face's
 * tag (a stacking-lip face reports LABEL_TAB). `setShapeOrigin` never has
 * this problem because it writes only live hashes.
 */
export function pruneStaleOrigins(shape: Shape3D): void {
  const origins = getFaceOrigins(shape);
  if (!origins) return;
  const live = new Set(getFaces(shape).map((face) => getHashCode(face)));
  for (const hash of origins.keys()) {
    if (!live.has(hash)) origins.delete(hash);
  }
}
