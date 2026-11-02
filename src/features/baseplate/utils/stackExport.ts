/**
 * Bake stacked baseplate geometry for export as triangle soup (9 floats/triangle),
 * laid out as `buildTowerLayers` lays out a tower.
 */

import type { StackPrintParams } from '@/core/types';
import {
  buildTowerLayers,
  concatMeshes,
  meshBounds,
  stackStrideMm,
  DEFAULT_PLATE_FLIP,
  type PlateFlip,
} from './stackPrint';

export interface StackExportSoup {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
}

/**
 * Build a vertical stack of `copies` plates from one plate's triangle soup, each
 * separated by `stack.gapMm` so the printed tower snaps apart. `flip` comes from
 * `planPlateFlip`.
 */
export function buildStackExportSoup(
  baseVertices: Float32Array,
  baseNormals: Float32Array,
  copies: number,
  stack: StackPrintParams,
  flip: PlateFlip = DEFAULT_PLATE_FLIP
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
  const plates = concatMeshes(buildTowerLayers(base, copies, stride, flip));
  return { vertices: plates.vertices, normals: plates.normals };
}
