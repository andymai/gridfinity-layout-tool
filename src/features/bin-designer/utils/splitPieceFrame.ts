/**
 * Moves a split preview piece from its own frame into the bin's. The worker
 * centres each preview piece on its own footprint, but color classification
 * reads positions (lip corners, compartment cells) in the bin's frame, so a
 * piece is colored and rendered there and only the explode gap moves it.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import type { SplitPieceMeshEntry } from '../types';
import { GRIDFINITY } from '../constants/gridfinity';

export interface SplitPieceBinFrameMesh {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  readonly faceGroups: readonly FaceGroupData[] | null;
}

interface BinFootprint {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY?: number;
}

/** Center of a piece's footprint in the bin's frame (mm). */
export function splitPieceCenterMm(
  entry: Pick<SplitPieceMeshEntry, 'widthUnits' | 'depthUnits' | 'offsetX' | 'offsetY'>,
  bin: BinFootprint
): { readonly x: number; readonly y: number } {
  const pitchX = bin.gridUnitMm;
  const pitchY = bin.gridUnitMmY ?? bin.gridUnitMm;
  const totalW = bin.width * pitchX - GRIDFINITY.TOLERANCE;
  const totalD = bin.depth * pitchY - GRIDFINITY.TOLERANCE;
  return {
    x: entry.offsetX * pitchX + (entry.widthUnits * pitchX) / 2 - totalW / 2,
    y: entry.offsetY * pitchY + (entry.depthUnits * pitchY) / 2 - totalD / 2,
  };
}

function shiftXY(points: Float32Array | null, dx: number, dy: number): Float32Array | null {
  if (!points) return null;
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    out[i] = points[i] + dx;
    out[i + 1] = points[i + 1] + dy;
    out[i + 2] = points[i + 2];
  }
  return out;
}

export function splitPieceInBinFrame(
  entry: SplitPieceMeshEntry,
  bin: BinFootprint
): SplitPieceBinFrameMesh {
  const { x, y } = splitPieceCenterMm(entry, bin);
  return {
    vertices: shiftXY(entry.mesh.vertices, x, y),
    normals: entry.mesh.normals,
    indices: entry.mesh.indices,
    edgeVertices: shiftXY(entry.mesh.edgeVertices, x, y),
    faceGroups: entry.mesh.faceGroups ?? null,
  };
}
