/**
 * Bake stacked baseplate geometry for export as triangle soup (9 floats/triangle).
 * Sacrificial-sheet mode inserts a sheet at each seam tagged material index 1.
 */

import type { StackPrintParams } from '@/core/types';
import {
  flipMeshUpsideDown,
  translateMeshZ,
  concatMeshes,
  meshBounds,
  buildInterfaceSheetMesh,
  stackStrideMm,
  type StackMeshArrays,
} from './stackPrint';

export interface StackExportSoup {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  /** Per-triangle material index (0 = plate, 1 = interface sheet). Sheet mode only. */
  readonly materialIndices?: number[];
}

/** Expand an indexed mesh into a flat triangle soup (vertices + normals). */
function toSoup(m: StackMeshArrays): { vertices: Float32Array; normals: Float32Array } {
  const vertices = new Float32Array(m.indices.length * 3);
  const normals = new Float32Array(m.indices.length * 3);
  for (let i = 0; i < m.indices.length; i++) {
    const src = m.indices[i] * 3;
    const dst = i * 3;
    vertices[dst] = m.vertices[src];
    vertices[dst + 1] = m.vertices[src + 1];
    vertices[dst + 2] = m.vertices[src + 2];
    normals[dst] = m.normals[src];
    normals[dst + 1] = m.normals[src + 1];
    normals[dst + 2] = m.normals[src + 2];
  }
  return { vertices, normals };
}

interface BuildStackOptions {
  /** Insert dissimilar-material sheets at each seam (3MF multi-material only). */
  readonly includeSheets: boolean;
}

/**
 * Build a vertical stack of `copies` flipped plates from one plate's triangle
 * soup. Copies are separated by `stack.gapMm` (air gap, or sheet thickness in
 * sheet mode). When `includeSheets` is set, sheet geometry is appended and a
 * per-triangle material-index array is returned.
 */
export function buildStackExportSoup(
  baseVertices: Float32Array,
  baseNormals: Float32Array,
  copies: number,
  stack: StackPrintParams,
  options: BuildStackOptions
): StackExportSoup {
  if (baseVertices.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0) };
  }
  const n = Math.max(1, Math.floor(copies));
  const sheetThickness = stack.gapMm;

  const bounds = meshBounds(baseVertices);
  const plateHeight = bounds.maxZ - bounds.minZ;
  const pivotZ = (bounds.minZ + bounds.maxZ) / 2;

  const base: StackMeshArrays = {
    vertices: baseVertices,
    normals: baseNormals,
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
  };
  // Flip upside down (pockets face down) then drop so the stack starts at Z=0.
  const flipped = translateMeshZ(flipMeshUpsideDown(base, pivotZ), -bounds.minZ);
  const stride = stackStrideMm(plateHeight, stack);

  const layers: StackMeshArrays[] = [];
  for (let i = 0; i < n; i++) {
    layers.push(i === 0 ? flipped : translateMeshZ(flipped, i * stride));
  }
  const plates = concatMeshes(layers);
  const plateTriangles = plates.vertices.length / 9;

  if (!options.includeSheets || stack.mode !== 'sacrificialSheet' || n < 2) {
    return { vertices: plates.vertices, normals: plates.normals };
  }

  // Sheet sits in the seam between copy j (top at j*stride + plateHeight) and
  // copy j+1 (bottom at (j+1)*stride).
  const sheets: { vertices: Float32Array; normals: Float32Array }[] = [];
  for (let j = 0; j < n - 1; j++) {
    const bottomZ = j * stride + plateHeight;
    sheets.push(toSoup(buildInterfaceSheetMesh(bounds, sheetThickness, bottomZ)));
  }

  const sheetLen = sheets.reduce((sum, s) => sum + s.vertices.length, 0);
  const vertices = new Float32Array(plates.vertices.length + sheetLen);
  const normals = new Float32Array(plates.normals.length + sheetLen);
  vertices.set(plates.vertices, 0);
  normals.set(plates.normals, 0);
  let off = plates.vertices.length;
  let sheetTriangles = 0;
  for (const s of sheets) {
    vertices.set(s.vertices, off);
    normals.set(s.normals, off);
    off += s.vertices.length;
    sheetTriangles += s.vertices.length / 9;
  }

  const materialIndices = [
    ...new Array<number>(plateTriangles).fill(0),
    ...new Array<number>(sheetTriangles).fill(1),
  ];
  return { vertices, normals, materialIndices };
}
