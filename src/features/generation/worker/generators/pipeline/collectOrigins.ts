/**
 * Face provenance collector.
 *
 * Tags every face of `shape` with `tag` using brepjs's `setShapeOrigin`, which
 * stores the tag in a WeakMap keyed by the shape's wrapped WASM handle. The
 * kernel propagates these origins through boolean ops (fuse / cut) and
 * transforms (translate / rotate) automatically, so faces in the final fused
 * solid still report the tag of whichever input shape contributed them.
 *
 * Why: a face group's `origin` field comes from `getFaceOrigins(shape)`, which
 * is empty unless `setShapeOrigin` was called on the shape (or an ancestor).
 * Without this call the origin defaults to 0 for every face, and downstream
 * tag lookup collapses to whichever feature ran last — every face gets the
 * same color. The legacy implementation walked face groups and stored their
 * origins in a map, but since every origin was 0 the map only ever held one
 * entry. See `toIndexedMeshData` for how the propagated origin is read back.
 *
 * The `map` parameter is kept for call-site compatibility with the pipeline
 * context (and used as a session-scoped sanity-check that the tag was set).
 */

import { setShapeOrigin } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { FeatureTag } from '../featureTags';

export function collectOrigins(shape: Shape3D, tag: FeatureTag, map: Map<number, number>): void {
  setShapeOrigin(shape, tag);
  map.set(tag, tag);
}
