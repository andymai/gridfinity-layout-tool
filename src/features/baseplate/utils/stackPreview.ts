/**
 * Build the 3D-preview geometry for a stack-print job: each tower (bottom plate
 * upright, the rest flipped) laid out in a centered, roughly-square grid, with
 * `separationMm` exploding copies apart without changing the exported gap.
 */

import type { StackPrintParams } from '@/core/types';
import {
  buildTowerLayers,
  translateMesh,
  concatMeshes,
  meshBounds,
  stackStrideMm,
  type StackMeshArrays,
} from './stackPrint';

/**
 * Empty grid units of clearance between towers. Added to each tower's
 * whole-unit footprint so every cell still spans an integer number of grid
 * cells (keeping towers on the scene's footprint grid), while one unit of
 * separation reads clearly as "separate printed pieces" without leaving an
 * empty grid cell of dead space around each tower.
 */
const TOWER_GAP_UNITS = 1;

export interface StackPreviewTower {
  readonly mesh: StackMeshArrays;
  readonly copies: number;
}

export interface StackPreviewResult {
  /** All plate copies across all towers. */
  readonly plates: StackMeshArrays;
  /** Overall layout extents, for camera framing. */
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

const EMPTY: StackMeshArrays = {
  vertices: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  edgeVertices: new Float32Array(0),
};

export function buildStackPreviewMeshes(
  towers: readonly StackPreviewTower[],
  stack: StackPrintParams,
  separationMm: number,
  gridUnitMm: number
): StackPreviewResult {
  if (towers.length === 0) {
    return { plates: EMPTY, widthMm: 0, depthMm: 0, heightMm: 0 };
  }

  const measured = towers.map((tower) => {
    const b = meshBounds(tower.mesh.vertices);
    return {
      tower,
      bounds: b,
      width: b.maxX - b.minX,
      depth: b.maxY - b.minY,
      plateHeight: b.maxZ - b.minZ,
    };
  });

  // Lay the towers in a roughly-square grid (a single row reads as a confusing
  // off-screen line once a drawer splits into many pieces). Uniform cell size
  // keeps the grid aligned; each tower is centered in its cell.
  const cols = Math.ceil(Math.sqrt(measured.length));
  const rows = Math.ceil(measured.length / cols);
  // Cell size = (largest tower footprint, rounded up to whole grid units) +
  // TOWER_GAP_UNITS, so every cell spans a whole number of grid cells and each
  // tower's edges fall on grid lines (see TOWER_GAP_UNITS).
  const maxWidthUnits = Math.max(...measured.map((m) => Math.ceil(m.width / gridUnitMm)), 1);
  const maxDepthUnits = Math.max(...measured.map((m) => Math.ceil(m.depth / gridUnitMm)), 1);
  const cellW = (maxWidthUnits + TOWER_GAP_UNITS) * gridUnitMm;
  const cellD = (maxDepthUnits + TOWER_GAP_UNITS) * gridUnitMm;

  const plateLayers: StackMeshArrays[] = [];
  let maxHeight = 0;

  measured.forEach((m, idx) => {
    const stride = stackStrideMm(m.plateHeight, stack) + Math.max(0, separationMm);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const centerX = (col - (cols - 1) / 2) * cellW;
    const centerY = ((rows - 1) / 2 - row) * cellD;

    // Build the tower (bottom upright, rest flipped, XY-aligned to the source
    // footprint, bottom at Z=0), then recenter it on its grid cell.
    const layers = buildTowerLayers(m.tower.mesh, m.tower.copies, stride);
    const midX = (m.bounds.minX + m.bounds.maxX) / 2;
    const midY = (m.bounds.minY + m.bounds.maxY) / 2;
    for (const layer of layers) {
      plateLayers.push(translateMesh(layer, centerX - midX, centerY - midY, 0));
    }

    const n = Math.max(1, Math.floor(m.tower.copies));
    maxHeight = Math.max(maxHeight, (n - 1) * stride + m.plateHeight);
  });

  return {
    plates: concatMeshes(plateLayers),
    widthMm: cols * cellW,
    depthMm: rows * cellD,
    heightMm: maxHeight,
  };
}
