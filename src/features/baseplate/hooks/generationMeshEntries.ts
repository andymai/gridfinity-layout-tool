/** Mesh-entry bookkeeping for baseplate generation results: per-piece entries, group fill-in, single-mesh views. */

import type { PieceMeshEntry } from '../store/baseplatePageStore';
import type { GenerationResult } from '@/shared/generation/bridge';
import type { BaseplateTiling } from '../types/tiling';

/** Build a PieceMeshEntry from a generation result and tiling piece metadata */
function buildPieceMeshEntry(
  result: GenerationResult,
  piece: {
    label: string;
    col: number;
    row: number;
    gridOffsetX: number;
    gridOffsetY: number;
    widthUnits: number;
    depthUnits: number;
    placementRotationDeg: 0 | 180;
  }
): PieceMeshEntry {
  return {
    label: piece.label,
    col: piece.col,
    row: piece.row,
    mesh: {
      vertices: result.mesh.vertices,
      normals: result.mesh.normals,
      indices: result.mesh.indices,
      edgeVertices: result.mesh.edgeVertices,
      error: null,
      timingMs: result.timingMs,
    },
    offsetX: piece.gridOffsetX,
    offsetY: piece.gridOffsetY,
    widthUnits: piece.widthUnits,
    depthUnits: piece.depthUnits,
    placementRotationDeg: piece.placementRotationDeg,
  };
}

export const EMPTY_MESH = {
  vertices: null,
  normals: null,
  indices: null,
  edgeVertices: null,
  error: null,
  timingMs: 0,
} as const;

/**
 * Fill one group's slots in the pre-sized piece-mesh array: the first piece
 * keeps the original result, duplicates get cloned typed arrays so Three.js
 * never shares buffers across pieces.
 */
export function fillGroupMeshEntries(
  meshEntries: PieceMeshEntry[],
  group: { indices: readonly number[] },
  pieces: BaseplateTiling['pieces'],
  result: GenerationResult
): void {
  group.indices.forEach((pieceIdx, j) => {
    const pieceResult = j === 0 ? result : cloneGenerationResult(result);
    meshEntries[pieceIdx] = buildPieceMeshEntry(pieceResult, pieces[pieceIdx]);
  });
}

/** Clone mesh buffers so each piece gets independent typed arrays for Three.js. */
function cloneGenerationResult(result: GenerationResult): GenerationResult {
  return {
    mesh: {
      ...result.mesh,
      vertices: result.mesh.vertices.slice(),
      normals: result.mesh.normals.slice(),
      indices: result.mesh.indices.slice(),
      edgeVertices: result.mesh.edgeVertices.slice(),
    },
    timingMs: 0,
  };
}

/** Single-mesh store payload for the unsplit baseplate (draft and BREP share this shape). */
export function toSingleMesh(result: GenerationResult) {
  return {
    vertices: result.mesh.vertices,
    normals: result.mesh.normals,
    indices: result.mesh.indices,
    edgeVertices: result.mesh.edgeVertices,
    error: null,
    timingMs: result.timingMs,
  };
}

/**
 * True when there is a visible mesh on the canvas (single OR any split piece).
 *
 * Drives the "graceful BREP failure" branch: if a preview is on screen we keep
 * it visible and surface the BREP error as a toast instead of replacing the
 * canvas with a red error overlay.
 *
 * The null checks are spelled out on purpose: `mesh?.vertices !== null`
 * short-circuits to `undefined !== null` (true) when `mesh` itself is null and
 * would report a preview on a blank canvas.
 */
export function hasMeshOnScreen(state: {
  pieceMeshes: { length: number };
  generation: { mesh: { vertices: Float32Array | null } | null };
}): boolean {
  if (state.pieceMeshes.length > 0) return true;
  const mesh = state.generation.mesh;
  return mesh !== null && mesh.vertices !== null;
}
