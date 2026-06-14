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

  // Pre-measure each tower so the row can be centered on X.
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
  const totalWidth =
    measured.reduce((sum, m) => sum + m.width, 0) + TOWER_SPACING_MM * (measured.length - 1);
  const maxDepth = Math.max(...measured.map((m) => m.depth));

  const plateLayers: StackMeshArrays[] = [];
  const sheetLayers: StackMeshArrays[] = [];
  const wantSheets = stack.mode === 'sacrificialSheet';
  let maxHeight = 0;
  let cursorX = -totalWidth / 2;

  for (const m of measured) {
    const n = Math.max(1, Math.floor(m.tower.copies));
    const stride = stackStrideMm(m.plateHeight, stack) + Math.max(0, separationMm);
    // Center this tower's footprint at cursorX + width/2; drop so it starts at Z=0.
    const centerX = cursorX + m.width / 2;
    const dx = centerX - (m.bounds.minX + m.bounds.maxX) / 2;
    const flipped = translateMesh(
      flipMeshUpsideDown(m.tower.mesh, (m.bounds.minZ + m.bounds.maxZ) / 2),
      dx,
      0,
      -m.bounds.minZ
    );

    for (let i = 0; i < n; i++) {
      plateLayers.push(i === 0 ? flipped : translateMesh(flipped, 0, 0, i * stride));
    }

    if (wantSheets && n > 1) {
      const footprint = {
        minX: m.bounds.minX + dx,
        maxX: m.bounds.maxX + dx,
        minY: m.bounds.minY,
        maxY: m.bounds.maxY,
      };
      for (let j = 0; j < n - 1; j++) {
        const bottomZ = j * stride + m.plateHeight;
        sheetLayers.push(buildInterfaceSheetMesh(footprint, stack.gapMm, bottomZ));
      }
    }

    maxHeight = Math.max(maxHeight, (n - 1) * stride + m.plateHeight);
    cursorX += m.width + TOWER_SPACING_MM;
  }

  return {
    plates: concatMeshes(plateLayers),
    sheets: sheetLayers.length > 0 ? concatMeshes(sheetLayers) : null,
    widthMm: totalWidth,
    depthMm: maxDepth,
    heightMm: maxHeight,
  };
}
