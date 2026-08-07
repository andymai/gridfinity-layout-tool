/**
 * glTF allows a primitive to omit NORMAL, and three.js answers that by turning
 * on `flatShading`, which derives the normal in the fragment shader as
 * `normalize(cross(dFdx(pos), dFdy(pos)))`. On the sliver triangles BREP
 * tessellation leaves behind, that cross product underflows to zero at fp32 and
 * `normalize(vec3(0))` is undefined, so the GPU emits NaN, the lighting term
 * blows out, and the sliver lands as a single white pixel.
 *
 * The repair is here rather than in the publish-time exporter for two reasons:
 * the exported geometry is non-indexed, so a NORMAL attribute costs 12 bytes on
 * every triangle corner against a 2 MB publish cap, and an exporter fix can
 * never reach a design that is already published.
 */

import type { Material, Mesh, Object3D } from 'three';

function isMesh(object: Object3D): object is Mesh {
  return 'isMesh' in object && object.isMesh === true;
}

function isFlatShadable(material: Material): material is Material & { flatShading: boolean } {
  return 'flatShading' in material;
}

/**
 * Give every normal-less mesh under `root` computed normals, and take its
 * material off flat shading so the computed values are actually used —
 * `flatShading` ignores the attribute and keeps deriving, NaN included.
 *
 * Idempotent: a mesh that already carries normals is left untouched, so this is
 * safe against the GLTF loader cache handing back a scene that was already
 * repaired by an earlier mount.
 */
export function ensureVertexNormals(root: Object3D): void {
  root.traverse((object) => {
    if (!isMesh(object)) return;
    if (object.geometry.hasAttribute('normal')) return;

    object.geometry.computeVertexNormals();

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!isFlatShadable(material)) continue;
      material.flatShading = false;
      material.needsUpdate = true;
    }
  });
}
