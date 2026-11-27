import type { MeshData } from '@/shared/types/generation';

/**
 * Every printed part of a design: the body and the separate parts it ships
 * with. Not the coarse level of detail, which is a copy, and not label plates,
 * which the mesh cache strips, so a cached and a fresh mesh count the same.
 */
export function meshTriangles(mesh: MeshData): number {
  const parts: ({ readonly triangleCount: number } | undefined)[] = [
    mesh.lidMesh,
    mesh.stackPlateMesh,
    mesh.slideTrayMesh,
    mesh.detachableFeetMesh,
    mesh.knifeRestMesh,
    mesh.slantSupportMesh,
    mesh.connectorKeyMesh,
  ];
  return parts.reduce((sum, part) => sum + (part?.triangleCount ?? 0), mesh.triangleCount);
}
