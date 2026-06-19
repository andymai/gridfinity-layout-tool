/**
 * Bake stacked baseplate geometry for export as triangle soup (9 floats/triangle):
 * the bottom plate upright, the rest flipped, separated by an air gap.
 */

import type { StackPrintParams } from '@/core/types';
import { buildTowerLayers, concatMeshes, meshBounds, stackStrideMm } from './stackPrint';

export interface StackExportSoup {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
}

/**
 * Build a vertical stack of `copies` plates from one plate's triangle soup. The
 * bottom plate is upright; the rest are flipped upside down, each separated by
 * `stack.gapMm` so the printed tower snaps apart. `bodyCenterYMm` is the plate's
 * connector-free body centre, so the flipped plates seat squarely on the upright
 * one instead of being dragged off-axis by a protruding connector tongue.
 */
export function buildStackExportSoup(
  baseVertices: Float32Array,
  baseNormals: Float32Array,
  copies: number,
  stack: StackPrintParams,
  bodyCenterYMm = 0
): StackExportSoup {
  if (baseVertices.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0) };
  }

  const bounds = meshBounds(baseVertices);
  const plateHeight = bounds.maxZ - bounds.minZ;
  const stride = stackStrideMm(plateHeight, stack);

  const base = {
    vertices: baseVertices,
    normals: baseNormals,
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
  };
  const plates = concatMeshes(buildTowerLayers(base, copies, stride, bodyCenterYMm));
  return { vertices: plates.vertices, normals: plates.normals };
}
