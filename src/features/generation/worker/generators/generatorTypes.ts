/**
 * Shared types, constants, and utility functions for bin generator modules.
 *
 * All generator sub-modules (socketBuilder, boxBuilder, featureBuilder, shapeCache)
 * import from this file to avoid circular dependencies.
 */

import type { Drawing, PlaneName, SketchInterface, BooleanOptions } from 'brepjs';
import type { MeshData } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';

// ─── Progress Callback ───────────────────────────────────────────────────────

/** Progress callback for reporting generation stages */
export type ProgressFn = (stage: string, progress: number) => void;

// ─── Gridfinity Socket Constants ─────────────────────────────────────────────

export const SIZE = GRIDFINITY.GRID_SIZE;
export const CLEARANCE = GRIDFINITY.TOLERANCE;
export const CORNER_RADIUS = GRIDFINITY.SOCKET_CORNER_RADIUS;
export const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;
export const SOCKET_SMALL_TAPER = GRIDFINITY.SOCKET_SMALL_TAPER;
export const SOCKET_BIG_TAPER = GRIDFINITY.SOCKET_BIG_TAPER;
export const SOCKET_VERTICAL_PART = SOCKET_HEIGHT - SOCKET_SMALL_TAPER - SOCKET_BIG_TAPER;
export const SOCKET_TAPER_WIDTH = SOCKET_SMALL_TAPER + SOCKET_BIG_TAPER;
export const TOP_FILLET = GRIDFINITY.TOP_FILLET;

// ─── Stacking Lip Constants (per spec v5) ────────────────────────────────────

export const LIP_SMALL_TAPER = GRIDFINITY.LIP_SMALL_TAPER; // 0.7mm bottom chamfer
export const LIP_VERTICAL_PART = GRIDFINITY.LIP_VERTICAL_PART; // 1.8mm vertical
export const LIP_BIG_TAPER = GRIDFINITY.LIP_BIG_TAPER; // 1.9mm top chamfer
export const LIP_HEIGHT = LIP_SMALL_TAPER + LIP_VERTICAL_PART + LIP_BIG_TAPER; // 4.4mm total
export const LIP_TAPER_WIDTH = LIP_SMALL_TAPER + LIP_BIG_TAPER; // 2.6mm horizontal inset

// ─── Boolean Options Type ────────────────────────────────────────────────────

/** Boolean operation options including AbortSignal for cancellation. */
export type BooleanOpts = BooleanOptions;

// ─── Cell Decomposition ──────────────────────────────────────────────────────

/** Cell position info for iteration */
export interface CellInfo {
  /** Cell size in grid units (1 or 0.5) */
  readonly widthUnits: number;
  readonly depthUnits: number;
  /** Cell center position in mm (relative to bin center) */
  readonly centerX: number;
  readonly centerY: number;
}

/**
 * Decompose a grid dimension (in units) into an array of cell sizes (in units).
 * Full cells are 1.0 unit; a trailing half-cell is 0.5 unit.
 *
 * Examples:
 *   2.0 -> [1, 1]
 *   1.5 -> [1, 0.5]
 *   0.5 -> [0.5]
 *   3.0 -> [1, 1, 1]
 */
export function decomposeCells(gridUnits: number): number[] {
  const fullCells = Math.floor(gridUnits);
  const hasHalf = gridUnits - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array<number>(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  return cells;
}

/**
 * Decompose a grid dimension into all 0.5-unit cells (half sockets mode).
 * Each 1-unit cell becomes two 0.5-unit cells; trailing half-cells stay 0.5.
 *
 * Examples:
 *   2.0 -> [0.5, 0.5, 0.5, 0.5]
 *   1.5 -> [0.5, 0.5, 0.5]
 *   0.5 -> [0.5]
 *   1.0 -> [0.5, 0.5]
 */
export function decomposeHalfCells(gridUnits: number): number[] {
  const totalHalves = Math.round(gridUnits * 2);
  return Array<number>(totalHalves).fill(0.5);
}

/**
 * Iterate over all cells in a grid, calling the callback with cell info.
 * Encapsulates the common pattern of nested cell iteration with position tracking.
 *
 * When `halfSockets` is true, every cell is decomposed into 0.5-unit sub-cells,
 * so a 1x1 bin yields a 2x2 grid of 0.5x0.5 sockets.
 */
export function forEachCell(
  gridW: number,
  gridD: number,
  callback: (cell: CellInfo) => void,
  halfSockets = false
): void {
  const decompose = halfSockets ? decomposeHalfCells : decomposeCells;
  const cellsW = decompose(gridW);
  const cellsD = decompose(gridD);
  const totalW_mm = gridW * SIZE;
  const totalD_mm = gridD * SIZE;

  let xOffset = 0;
  for (const cellW_units of cellsW) {
    const centerX = xOffset + (cellW_units * SIZE) / 2 - totalW_mm / 2;
    let yOffset = 0;

    for (const cellD_units of cellsD) {
      const centerY = yOffset + (cellD_units * SIZE) / 2 - totalD_mm / 2;

      callback({
        widthUnits: cellW_units,
        depthUnits: cellD_units,
        centerX,
        centerY,
      });

      yOffset += cellD_units * SIZE;
    }
    xOffset += cellW_units * SIZE;
  }
}

// ─── Sketch Helper ───────────────────────────────────────────────────────────

/**
 * Sketch a drawing on a plane, narrowing to SketchInterface.
 * All our drawings are single closed wires, so SketchInterface is always the
 * correct runtime type. This eliminates repeated `as SketchInterface` casts.
 */
export function sketch(drawing: Drawing, plane?: PlaneName, origin?: number): SketchInterface {
  return drawing.sketchOnPlane(plane, origin) as SketchInterface;
}

// ─── Cancellation ────────────────────────────────────────────────────────────

/** Throw if the AbortSignal has been triggered (mid-operation cancellation). */
export function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
}

// ─── Mesh Conversion ─────────────────────────────────────────────────────────

/**
 * Convert brepjs indexed mesh to our MeshData format, keeping indexed representation.
 *
 * @param meshResult brepjs mesh with indexed vertices/normals/triangles
 * @param skipNormals If true, returns empty normals array (GPU will compute flat shading)
 */
export function toIndexedMeshData(
  meshResult: {
    vertices: ArrayLike<number>;
    normals: ArrayLike<number>;
    triangles: ArrayLike<number>;
  },
  skipNormals = false,
  edgeVertices?: ArrayLike<number>
): MeshData {
  return {
    vertices:
      meshResult.vertices instanceof Float32Array
        ? meshResult.vertices
        : new Float32Array(meshResult.vertices),
    normals: skipNormals
      ? new Float32Array(0)
      : meshResult.normals instanceof Float32Array
        ? meshResult.normals
        : new Float32Array(meshResult.normals),
    indices:
      meshResult.triangles instanceof Uint32Array
        ? meshResult.triangles
        : new Uint32Array(meshResult.triangles),
    edgeVertices: edgeVertices
      ? edgeVertices instanceof Float32Array
        ? edgeVertices
        : new Float32Array(edgeVertices)
      : new Float32Array(0),
    triangleCount: meshResult.triangles.length / 3,
  };
}
