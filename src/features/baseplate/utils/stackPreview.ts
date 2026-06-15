/**
 * Build the 3D-preview geometry for a stack-print job: flipped towers laid out in
 * a centered row, with `separationMm` exploding copies apart without changing the
 * exported gap. Sacrificial sheets return as a separate mesh for accent rendering.
 */

import type { StackPrintParams } from '@/core/types';
import {
  flipMeshUpsideDown,
  translateMesh,
  concatMeshes,
  meshBounds,
  buildInterfaceSheetMesh,
  stackStrideMm,
  type StackMeshArrays,
} from './stackPrint';

/** Gap (mm) between adjacent towers in the preview layout. */
const TOWER_SPACING_MM = 12;

export interface StackPreviewTower {
  readonly mesh: StackMeshArrays;
  readonly copies: number;
}

export interface StackPreviewResult {
  /** All plate copies across all towers (single material). */
  readonly plates: StackMeshArrays;
  /** Sacrificial interface sheets, or null in air-gap mode. */
  readonly sheets: StackMeshArrays | null;
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
  separationMm: number
): StackPreviewResult {
  if (towers.length === 0) {
    return { plates: EMPTY, sheets: null, widthMm: 0, depthMm: 0, heightMm: 0 };
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
  const cellW = Math.max(...measured.map((m) => m.width)) + TOWER_SPACING_MM;
  const cellD = Math.max(...measured.map((m) => m.depth)) + TOWER_SPACING_MM;

  const plateLayers: StackMeshArrays[] = [];
  const sheetLayers: StackMeshArrays[] = [];
  const wantSheets = stack.mode === 'sacrificialSheet';
  let maxHeight = 0;

  measured.forEach((m, idx) => {
    const n = Math.max(1, Math.floor(m.tower.copies));
    const stride = stackStrideMm(m.plateHeight, stack) + Math.max(0, separationMm);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const centerX = (col - (cols - 1) / 2) * cellW;
    const centerY = ((rows - 1) / 2 - row) * cellD;
    const dx = centerX - (m.bounds.minX + m.bounds.maxX) / 2;
    const dy = centerY - (m.bounds.minY + m.bounds.maxY) / 2;
    // Flip upside down (matches the printed orientation) and drop to Z=0.
    const flipped = translateMesh(
      flipMeshUpsideDown(m.tower.mesh, (m.bounds.minZ + m.bounds.maxZ) / 2),
      dx,
      dy,
      -m.bounds.minZ
    );

    for (let i = 0; i < n; i++) {
      plateLayers.push(i === 0 ? flipped : translateMesh(flipped, 0, 0, i * stride));
    }

    if (wantSheets && n > 1) {
      const footprint = {
        minX: m.bounds.minX + dx,
        maxX: m.bounds.maxX + dx,
        minY: m.bounds.minY + dy,
        maxY: m.bounds.maxY + dy,
      };
      for (let j = 0; j < n - 1; j++) {
        const bottomZ = j * stride + m.plateHeight;
        sheetLayers.push(buildInterfaceSheetMesh(footprint, stack.gapMm, bottomZ));
      }
    }

    maxHeight = Math.max(maxHeight, (n - 1) * stride + m.plateHeight);
  });

  return {
    plates: concatMeshes(plateLayers),
    sheets: sheetLayers.length > 0 ? concatMeshes(sheetLayers) : null,
    widthMm: cols * cellW,
    depthMm: rows * cellD,
    heightMm: maxHeight,
  };
}
