/**
 * Binary STL emitter for baseplate geometry.
 *
 * brepjs/OCCT historically emitted tessellated meshes whose face orientations
 * weren't consistent across the whole solid: for some baseplate piece configs
 * (corner-3, corner-4, edge-x-1) the bottom face and parts of the
 * dovetail/pocket walls were wound backwards, causing slicers to flag
 * thousands of "non-manifold edges" (#1490). The downstream `repairMeshWinding`
 * BFS pass corrects this before emitting the STL.
 *
 * Investigation status (#1494): with brepjs 15.6.1 + OCCT kernel, the repair
 * is currently a no-op for every known piece config — see
 * `__dual-kernel__/diagnoseBaseplateWinding.test.ts`. The pass is kept as a
 * defensive net for any future regression in brepjs/OCCT tessellation.
 *
 * (An even earlier version applied a per-triangle (cross · sum-of-vertex-
 * normals) heuristic which mis-fired on ~7% of triangles at curved/shared
 * edges; that was the issue tracked in #1472 and the heuristic was removed
 * in #1473.)
 *
 * The STL face normal is the cross-product of the (corrected) winding edges,
 * the same convention slicers reconstruct anyway.
 */

import { repairMeshWinding } from '@/shared/generation/repairMeshWinding';

export function buildBaseplateSTL(
  meshResult: {
    vertices: ArrayLike<number>;
    triangles: ArrayLike<number>;
  },
  name: string
): ArrayBuffer {
  const verts = meshResult.vertices;
  const tris = repairMeshWinding(meshResult.vertices, meshResult.triangles);
  const triangleCount = tris.length / 3;

  const HEADER_SIZE = 80;
  const COUNT_SIZE = 4;
  const TRIANGLE_SIZE = 50;
  const buffer = new ArrayBuffer(HEADER_SIZE + COUNT_SIZE + triangleCount * TRIANGLE_SIZE);
  const view = new DataView(buffer);

  const header = `Exported by Gridfinity Layout Tool - ${name}`;
  const headerBytes = new TextEncoder().encode(header);
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < headerBytes.length ? headerBytes[i] : 0);
  }
  view.setUint32(HEADER_SIZE, triangleCount, true);

  let offset = HEADER_SIZE + COUNT_SIZE;
  for (let t = 0; t < triangleCount; t++) {
    const i0 = tris[t * 3];
    const i1 = tris[t * 3 + 1];
    const i2 = tris[t * 3 + 2];

    const v0x = verts[i0 * 3];
    const v0y = verts[i0 * 3 + 1];
    const v0z = verts[i0 * 3 + 2];
    const v1x = verts[i1 * 3];
    const v1y = verts[i1 * 3 + 1];
    const v1z = verts[i1 * 3 + 2];
    const v2x = verts[i2 * 3];
    const v2y = verts[i2 * 3 + 1];
    const v2z = verts[i2 * 3 + 2];

    const ex = v1x - v0x;
    const ey = v1y - v0y;
    const ez = v1z - v0z;
    const fx = v2x - v0x;
    const fy = v2y - v0y;
    const fz = v2z - v0z;
    const cx = ey * fz - ez * fy;
    const cy = ez * fx - ex * fz;
    const cz = ex * fy - ey * fx;

    const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    view.setFloat32(offset, cx / len, true);
    view.setFloat32(offset + 4, cy / len, true);
    view.setFloat32(offset + 8, cz / len, true);
    offset += 12;

    // Unrolled vertex writes — large baseplates emit hundreds of thousands of
    // triangles, so avoid per-iteration array allocation in this hot loop.
    view.setFloat32(offset, v0x, true);
    view.setFloat32(offset + 4, v0y, true);
    view.setFloat32(offset + 8, v0z, true);
    offset += 12;
    view.setFloat32(offset, v1x, true);
    view.setFloat32(offset + 4, v1y, true);
    view.setFloat32(offset + 8, v1z, true);
    offset += 12;
    view.setFloat32(offset, v2x, true);
    view.setFloat32(offset + 4, v2y, true);
    view.setFloat32(offset + 8, v2z, true);
    offset += 12;

    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}
