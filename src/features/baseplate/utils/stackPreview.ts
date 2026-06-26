/**
 * Build the 3D-preview geometry for a stack-print job: each tower (bottom plate
 * upright, the rest flipped) with `separationMm` exploding copies apart without
 * changing the exported gap.
 *
 * Layout has two modes. When every tower carries its tiling `col`/`row` (the
 * "no stacks" case — each split piece is its own single-plate tower, no
 * fingerprint dedup), towers are placed on their real tiling grid in the same
 * orientation as the assembled split view (row 0 at the front), so the preview
 * reads in the same order as the baseplate. Otherwise — deduped or genuinely
 * stacked towers, which no longer map 1:1 to spatial positions — they fall back
 * to a centered, roughly-square grid (a single row reads as a confusing
 * off-screen line once a drawer splits into many pieces).
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
  /** Connector-free body-centre Y (mm) of the plate, for flip alignment. */
  readonly bodyCenterYMm: number;
  /**
   * Tiling grid position of the piece this tower prints. Set only when towers
   * map 1:1 to split pieces ("no stacks"); when every tower carries both, the
   * layout matches the assembled split view instead of the square grid.
   */
  readonly col?: number;
  readonly row?: number;
}

export interface StackPreviewTowerLayout {
  readonly centerX: number;
  readonly centerY: number;
  readonly heightMm: number;
}

export interface StackPreviewResult {
  /** All plate copies across all towers. */
  readonly plates: StackMeshArrays;
  /** Overall layout extents, for camera framing. */
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
  /** Per-tower scene positions, aligned with the input towers array. */
  readonly towerLayouts: readonly StackPreviewTowerLayout[];
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
    return { plates: EMPTY, widthMm: 0, depthMm: 0, heightMm: 0, towerLayouts: [] };
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

  // Spatial mode (every tower knows its tiling slot): place towers on their
  // real grid so the preview matches the assembled split view. Otherwise tile
  // into a roughly-square grid (see file header).
  const spatial = measured.every((m) => m.tower.col !== undefined && m.tower.row !== undefined);
  const cols = spatial
    ? Math.max(...measured.map((m) => m.tower.col ?? 0)) + 1
    : Math.ceil(Math.sqrt(measured.length));
  const rows = spatial
    ? Math.max(...measured.map((m) => m.tower.row ?? 0)) + 1
    : Math.ceil(measured.length / cols);
  // Cell size = (largest tower footprint, rounded up to whole grid units) +
  // TOWER_GAP_UNITS, so every cell spans a whole number of grid cells and each
  // tower's edges fall on grid lines (see TOWER_GAP_UNITS).
  const maxWidthUnits = Math.max(...measured.map((m) => Math.ceil(m.width / gridUnitMm)), 1);
  const maxDepthUnits = Math.max(...measured.map((m) => Math.ceil(m.depth / gridUnitMm)), 1);
  const cellW = (maxWidthUnits + TOWER_GAP_UNITS) * gridUnitMm;
  const cellD = (maxDepthUnits + TOWER_GAP_UNITS) * gridUnitMm;

  const plateLayers: StackMeshArrays[] = [];
  const towerLayouts: StackPreviewTowerLayout[] = [];
  let maxHeight = 0;

  measured.forEach((m, idx) => {
    const stride = stackStrideMm(m.plateHeight, stack) + Math.max(0, separationMm);
    const col = spatial ? (m.tower.col ?? 0) : idx % cols;
    const row = spatial ? (m.tower.row ?? 0) : Math.floor(idx / cols);
    const centerX = (col - (cols - 1) / 2) * cellW;
    // Spatial mode matches the assembled view, where row 0 sits at the front
    // (smallest Y) and Y grows with row; the square grid keeps row 0 on top.
    const centerY = spatial ? (row - (rows - 1) / 2) * cellD : ((rows - 1) / 2 - row) * cellD;

    // Build the tower (bottom upright, rest flipped, XY-aligned to the source
    // footprint, bottom at Z=0), then recenter it on its grid cell.
    const layers = buildTowerLayers(m.tower.mesh, m.tower.copies, stride, m.tower.bodyCenterYMm);
    const midX = (m.bounds.minX + m.bounds.maxX) / 2;
    const midY = (m.bounds.minY + m.bounds.maxY) / 2;
    for (const layer of layers) {
      plateLayers.push(translateMesh(layer, centerX - midX, centerY - midY, 0));
    }

    const n = Math.max(1, Math.floor(m.tower.copies));
    const towerHeight = (n - 1) * stride + m.plateHeight;
    maxHeight = Math.max(maxHeight, towerHeight);
    towerLayouts.push({ centerX, centerY, heightMm: towerHeight });
  });

  return {
    plates: concatMeshes(plateLayers),
    widthMm: cols * cellW,
    depthMm: rows * cellD,
    heightMm: maxHeight,
    towerLayouts,
  };
}
