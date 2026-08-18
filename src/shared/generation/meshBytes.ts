/**
 * Byte accounting for a generated {@link MeshData}.
 *
 * Two caches evict on a byte budget — the cross-session IndexedDB store
 * (`meshPersistence`) and the in-session bridge result cache
 * (`bridge/resultCache`) — and a budget is only as honest as the measurement
 * behind it. Sharing one walk means a new companion mesh is counted by both
 * the moment it is added here, rather than silently inflating whichever cache
 * forgot about it.
 *
 * Every optional companion is folded in, including the ones a given caller
 * happens to strip before storing: an undercount does not fail loudly, it just
 * lets the cache grow past the cap it claims to enforce.
 */

import type { MeshData } from '@/shared/types/generation';

interface BufferBearing {
  readonly vertices: { readonly byteLength: number };
  readonly normals?: { readonly byteLength: number };
  readonly indices: { readonly byteLength: number };
  readonly edgeVertices?: { readonly byteLength: number };
}

function partBytes(part: BufferBearing): number {
  return (
    part.vertices.byteLength +
    (part.normals?.byteLength ?? 0) +
    part.indices.byteLength +
    (part.edgeVertices?.byteLength ?? 0)
  );
}

/** Total bytes held by every typed array reachable from `mesh`. */
export function meshDataByteSize(mesh: MeshData): number {
  let bytes = partBytes(mesh);
  if (mesh.coarseLOD) bytes += partBytes(mesh.coarseLOD);
  if (mesh.lidMesh) bytes += partBytes(mesh.lidMesh);
  if (mesh.detachableFeetMesh) bytes += partBytes(mesh.detachableFeetMesh);
  if (mesh.knifeRestMesh) bytes += partBytes(mesh.knifeRestMesh);
  if (mesh.stackPlateMesh) bytes += partBytes(mesh.stackPlateMesh);
  if (mesh.slideTrayMesh) bytes += partBytes(mesh.slideTrayMesh);
  if (mesh.connectorKeyMesh) bytes += partBytes(mesh.connectorKeyMesh);
  if (mesh.labelPlates) {
    for (const plate of mesh.labelPlates.plates) bytes += partBytes(plate);
  }
  return bytes;
}
