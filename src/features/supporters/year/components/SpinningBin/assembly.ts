import type { MeshData } from '@/shared/types/generation';
import type { YearMesh } from '../../hooks/useYearMeshes';

export interface PlacedPart {
  readonly data: MeshData;
  /** Translation in the worker's Z-up frame, mm. */
  readonly offset: readonly [number, number, number];
}

function hasGeometry(part: { readonly vertices: Float32Array } | undefined): boolean {
  return part !== undefined && part.vertices.length > 0;
}

/**
 * Whether the turning bin can show every printed part. Feet and a slant
 * support arrive in the bin's own frame, and a knife rest steps beside it by
 * the shared mating plan. A lid, stack plate, slide tray or connector key
 * needs placement that only the designer has, so those designs keep their
 * thumbnail, which draws the lid.
 */
export function canSpin({ mesh, restOffset }: YearMesh): boolean {
  const unplaced = [mesh.lidMesh, mesh.stackPlateMesh, mesh.slideTrayMesh, mesh.connectorKeyMesh];
  if (unplaced.some(hasGeometry)) return false;
  return !hasGeometry(mesh.knifeRestMesh) || restOffset !== undefined;
}

export function assemblyParts(mesh: MeshData, restOffset?: YearMesh['restOffset']): PlacedPart[] {
  const parts: PlacedPart[] = [{ data: mesh, offset: [0, 0, 0] }];
  for (const part of [mesh.detachableFeetMesh, mesh.slantSupportMesh]) {
    if (part && hasGeometry(part)) parts.push({ data: part, offset: [0, 0, 0] });
  }
  if (mesh.knifeRestMesh && hasGeometry(mesh.knifeRestMesh) && restOffset) {
    parts.push({ data: mesh.knifeRestMesh, offset: [restOffset.x, restOffset.y, 0] });
  }
  return parts;
}

/**
 * The centre and the bounding-sphere radius of the parts' combined bounds, in
 * mm. A sphere, so the assembly stays in frame at every angle of the turn.
 */
export function assemblyBox(parts: readonly PlacedPart[]): {
  readonly center: readonly [number, number, number];
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly radius: number;
} {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { data, offset } of parts) {
    const v = data.vertices;
    for (let i = 0; i + 2 < v.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = (v[i + axis] ?? 0) + offset[axis];
        if (value < min[axis]) min[axis] = value;
        if (value > max[axis]) max[axis] = value;
      }
    }
  }
  if (!Number.isFinite(min[0])) {
    return { center: [0, 0, 0], min: [0, 0, 0], max: [0, 0, 0], radius: 0 };
  }
  const center = [0, 1, 2].map((axis) => (min[axis] + max[axis]) / 2) as [number, number, number];
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  return {
    center,
    min: [min[0], min[1], min[2]] as [number, number, number],
    max: [max[0], max[1], max[2]] as [number, number, number],
    radius,
  };
}
