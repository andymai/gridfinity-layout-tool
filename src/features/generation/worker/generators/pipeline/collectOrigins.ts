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

/**
 * Gives `target` the origins its faces carry in `sources`. A compound built
 * from parts, or a solid taken out of a compound, starts with no origins, and
 * an untagged face meshes as origin 0. Faces no source knows keep 0.
 */
export function copyFaceOrigins(target: Shape3D, sources: readonly Shape3D[]): void {
  const maps = sources
    .map((s) => getFaceOrigins(s))
    .filter((m): m is Map<number, number> => m !== undefined);
  if (maps.length === 0) return;
  setShapeOrigin(target, 0);
  const own = getFaceOrigins(target);
  if (!own) return;
  for (const hash of own.keys()) {
    for (const m of maps) {
      const origin = m.get(hash);
      if (origin !== undefined) {
        own.set(hash, origin);
        break;
      }
    }
  }
}
