/**
 * Pure helpers for vertical stack-printing of baseplates: plan physical stacks
 * from piece groups, and translate/flip/replicate mesh buffers + interface sheets.
 */

import type { StackPrintParams } from '@/core/types';
import { STACK_PRINT_MAX_STACK_HEIGHT } from '@/core/types';
import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';
import { groupPiecesByFingerprint } from './pieceFingerprint';

/** Non-null mesh buffers (xyz-interleaved positions/normals, line-pair edges). */
export interface StackMeshArrays {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
}

/** One unique-piece group needing `quantity` copies for a single complete set. */
export interface StackGroup {
  readonly label: string;
  readonly quantity: number;
}

/** One physical print job: a single piece repeated `copies` times in a tower. */
export interface PhysicalStack {
  readonly label: string;
  readonly copies: number;
}

/**
 * Plan the physical stacks for a drawer. Each group needs `quantity * sets`
 * copies; a group taller than `maxStackHeight` is split across several stacks
 * (e.g. 18 copies, cap 8 -> 8 + 8 + 2). Groups/quantities at or below zero are
 * skipped. Returns one entry per physical tower to print.
 */
export function planPhysicalStacks(
  groups: readonly StackGroup[],
  sets: number,
  maxStackHeight: number = STACK_PRINT_MAX_STACK_HEIGHT
): PhysicalStack[] {
  const safeSets = Number.isFinite(sets) ? Math.max(1, Math.floor(sets)) : 1;
  const cap = Number.isFinite(maxStackHeight) ? Math.max(1, Math.floor(maxStackHeight)) : 1;
  const stacks: PhysicalStack[] = [];

  for (const group of groups) {
    let remaining = Math.max(0, Math.floor(group.quantity)) * safeSets;
    while (remaining > 0) {
      const copies = Math.min(cap, remaining);
      stacks.push({ label: group.label, copies });
      remaining -= copies;
    }
  }

  return stacks;
}

/**
 * Derive the identical-piece groups a drawer needs. For a single (unsplit)
 * plate that's one group of quantity 1; for a split plate each fingerprint
 * group contributes its piece count, labelled by its first piece (e.g. "A1").
 */
export function stackGroupsFromTiling(
  tiling: BaseplateTiling | null,
  params: BaseplateParams
): StackGroup[] {
  if (!tiling || !tiling.isSplit) return [{ label: 'plate', quantity: 1 }];
  const groups = groupPiecesByFingerprint(tiling.pieces, params);
  const result: StackGroup[] = [];
  for (const group of groups.values()) {
    const label = tiling.pieces[group.indices[0]]?.label ?? 'piece';
    result.push({ label, quantity: group.indices.length });
  }
  return result;
}

/**
 * Z stride (mm) between successive copies in a stack: plate height plus the
 * separation interface. `gapMm` sizes the interface in both modes — an air gap
 * in air-gap mode, the dissimilar-material sheet thickness in sheet mode.
 */
export function stackStrideMm(plateHeightMm: number, stack: StackPrintParams): number {
  return plateHeightMm + Math.max(0, stack.gapMm);
}

/** Translate a copy of the mesh buffers along Z by `dzMm` (positions + edges). */
export function translateMeshZ(mesh: StackMeshArrays, dzMm: number): StackMeshArrays {
  return translateMesh(mesh, 0, 0, dzMm);
}

/** Translate a copy of the mesh buffers by (dx, dy, dz) (positions + edges). */
export function translateMesh(
  mesh: StackMeshArrays,
  dxMm: number,
  dyMm: number,
  dzMm: number
): StackMeshArrays {
  const vertices = new Float32Array(mesh.vertices);
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] += dxMm;
    vertices[i + 1] += dyMm;
    vertices[i + 2] += dzMm;
  }
  const edgeVertices = new Float32Array(mesh.edgeVertices);
  for (let i = 0; i < edgeVertices.length; i += 3) {
    edgeVertices[i] += dxMm;
    edgeVertices[i + 1] += dyMm;
    edgeVertices[i + 2] += dzMm;
  }
  return {
    vertices,
    normals: new Float32Array(mesh.normals),
    indices: new Uint32Array(mesh.indices),
    edgeVertices,
  };
}

/**
 * Flip the mesh upside down for printing — a 180° rotation about the X axis
 * through `pivotZMm` mapping (x,y,z) -> (x, 2*pivotZ - z) and negating the Y
 * component. This is a proper rotation (det = +1), so triangle winding and
 * normal orientation stay consistent — no index reversal needed. Shared by
 * export and the preview, which renders the printed (upside-down) orientation.
 */
export function flipMeshUpsideDown(mesh: StackMeshArrays, pivotZMm: number): StackMeshArrays {
  const vertices = new Float32Array(mesh.vertices);
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 1] = -vertices[i + 1];
    vertices[i + 2] = 2 * pivotZMm - vertices[i + 2];
  }
  const normals = new Float32Array(mesh.normals);
  for (let i = 0; i < normals.length; i += 3) {
    normals[i + 1] = -normals[i + 1];
    normals[i + 2] = -normals[i + 2];
  }
  const edgeVertices = new Float32Array(mesh.edgeVertices);
  for (let i = 0; i < edgeVertices.length; i += 3) {
    edgeVertices[i + 1] = -edgeVertices[i + 1];
    edgeVertices[i + 2] = 2 * pivotZMm - edgeVertices[i + 2];
  }
  return { vertices, normals, indices: new Uint32Array(mesh.indices), edgeVertices };
}

/** Concatenate several meshes into one buffer set, re-basing indices per mesh. */
export function concatMeshes(meshes: readonly StackMeshArrays[]): StackMeshArrays {
  let vLen = 0;
  let iLen = 0;
  let eLen = 0;
  for (const m of meshes) {
    vLen += m.vertices.length;
    iLen += m.indices.length;
    eLen += m.edgeVertices.length;
  }
  const vertices = new Float32Array(vLen);
  const normals = new Float32Array(vLen);
  const indices = new Uint32Array(iLen);
  const edgeVertices = new Float32Array(eLen);

  let vOff = 0;
  let iOff = 0;
  let eOff = 0;
  for (const m of meshes) {
    vertices.set(m.vertices, vOff);
    normals.set(m.normals, vOff);
    const baseVertex = vOff / 3;
    for (let k = 0; k < m.indices.length; k++) indices[iOff + k] = m.indices[k] + baseVertex;
    edgeVertices.set(m.edgeVertices, eOff);
    vOff += m.vertices.length;
    iOff += m.indices.length;
    eOff += m.edgeVertices.length;
  }

  return { vertices, normals, indices, edgeVertices };
}

/** Axis-aligned XY bounds + Z span of a mesh, from its vertex buffer. */
export function meshBounds(vertices: Float32Array): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Build a thin rectangular sacrificial interface sheet spanning the plate's XY
 * footprint, with its bottom face at `bottomZMm`. A small inset keeps the
 * sheet's square corners inside the plate's rounded outer wall so it never
 * pokes past the footprint. Returned as a closed box mesh (12 triangles).
 */
export function buildInterfaceSheetMesh(
  footprint: { minX: number; maxX: number; minY: number; maxY: number },
  thicknessMm: number,
  bottomZMm: number,
  insetMm = 0.5
): StackMeshArrays {
  const x0 = footprint.minX + insetMm;
  const x1 = footprint.maxX - insetMm;
  const y0 = footprint.minY + insetMm;
  const y1 = footprint.maxY - insetMm;
  const z0 = bottomZMm;
  const z1 = bottomZMm + Math.max(0, thicknessMm);

  // 8 corners, duplicated per face so each face carries a flat normal.
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  // Each face: 4 corner indices (CCW seen from outside) + outward normal.
  const faces: ReadonlyArray<{
    idx: readonly [number, number, number, number];
    n: readonly [number, number, number];
  }> = [
    { idx: [0, 3, 2, 1], n: [0, 0, -1] }, // bottom
    { idx: [4, 5, 6, 7], n: [0, 0, 1] }, // top
    { idx: [0, 1, 5, 4], n: [0, -1, 0] }, // front
    { idx: [2, 3, 7, 6], n: [0, 1, 0] }, // back
    { idx: [1, 2, 6, 5], n: [1, 0, 0] }, // right
    { idx: [3, 0, 4, 7], n: [-1, 0, 0] }, // left
  ];

  const vertices = new Float32Array(faces.length * 4 * 3);
  const normals = new Float32Array(faces.length * 4 * 3);
  const indices = new Uint32Array(faces.length * 6);
  let v = 0;
  let ii = 0;
  faces.forEach((face, f) => {
    const baseVertex = f * 4;
    for (let c = 0; c < 4; c++) {
      const [cx, cy, cz] = corners[face.idx[c]];
      vertices[v] = cx;
      vertices[v + 1] = cy;
      vertices[v + 2] = cz;
      normals[v] = face.n[0];
      normals[v + 1] = face.n[1];
      normals[v + 2] = face.n[2];
      v += 3;
    }
    indices[ii] = baseVertex;
    indices[ii + 1] = baseVertex + 1;
    indices[ii + 2] = baseVertex + 2;
    indices[ii + 3] = baseVertex;
    indices[ii + 4] = baseVertex + 2;
    indices[ii + 5] = baseVertex + 3;
    ii += 6;
  });

  // Edge wireframe: the 12 box edges (24 line-segment endpoints).
  const edgePairs: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const edgeVertices = new Float32Array(edgePairs.length * 2 * 3);
  let e = 0;
  for (const [a, b] of edgePairs) {
    edgeVertices.set(corners[a], e);
    edgeVertices.set(corners[b], e + 3);
    e += 6;
  }

  return { vertices, normals, indices, edgeVertices };
}
