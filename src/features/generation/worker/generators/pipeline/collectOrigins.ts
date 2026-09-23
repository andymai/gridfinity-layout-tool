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

import { getFaceOrigins, setShapeOrigin } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { FeatureTag } from '../featureTags';

export function collectOrigins(shape: Shape3D, tag: FeatureTag, _map: Map<number, number>): void {
  setShapeOrigin(shape, tag);
}

/**
 * Like {@link collectOrigins}, but a face that already carries a tag keeps it.
 * For a feature that tags a sub-part itself (label-tab glyphs as TEXT) while
 * the rest of its faces take the feature's own tag.
 */
export function tagUntaggedFaces(shape: Shape3D, tag: FeatureTag): void {
  const existing = getFaceOrigins(shape);
  const kept = existing ? new Map(existing) : undefined;
  setShapeOrigin(shape, tag);
  const map = getFaceOrigins(shape);
  if (!kept || !map) return;
  for (const [hash, origin] of kept) {
    if (map.has(hash)) map.set(hash, origin);
  }
}
