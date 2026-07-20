/**
 * Renders ghost label tab shelf planes in the 3D preview during mesh regeneration.
 *
 * Shows translucent amber quads at the top of each compartment's back edge where
 * label tabs will appear. Provides immediate visual feedback when the user changes
 * label tab width, depth, alignment, or support style.
 *
 * Position math mirrors binGenerator.ts buildLabelTabs.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  getCompartmentBounds,
} from '@/features/bin-designer/utils/compartments';

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.45;

export function GhostLabelTabs() {
  const { invalidate } = useThree();

  const {
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    wallThickness,
    style,
    baseStyle,
    compartments,
    label,
    generationStatus,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      heightUnitMm: s.params.heightUnitMm,
      wallThickness: s.params.wallThickness,
      style: s.params.style,
      baseStyle: s.params.base.style,
      compartments: s.params.compartments,
      label: s.params.label,
      generationStatus: s.generation.status,
    }))
  );
  const { cols, rows, thickness, cells } = compartments;

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * heightUnitMm;
  // Floor sits at SOCKET_HEIGHT for socketed bins, at z=0 for flat. The wall
  // top is at totalH in both cases (the socket extends below the floor).
  // Mirrors `binDimensions`.
  const wallHeightMm = baseStyle === 'flat' ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const floorZ = baseStyle === 'flat' ? 0 : GRIDFINITY.SOCKET_HEIGHT;
  // World Z of the shelf TOP. When `label.height` is absent, this matches the
  // legacy `topZ = totalH` (wall top). With it set, the shelf drops below the
  // rim — keep the ghost in lockstep with the BREP builder's anchor so the
  // user sees instant feedback while regeneration is in flight (#1898).
  const shelfTopWorldZ = floorZ + (label.height ?? wallHeightMm);

  const shouldShow =
    label.enabled &&
    style !== 'slotted' &&
    generationStatus === 'generating' &&
    cells.length >= rows * cols;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const cellW = innerW / cols;
    const cellD = innerD / rows;
    // Socket mode (#2666) forces full-width tabs in the worker; mirror that.
    // (The rare bin-spanning fallback — no compartment fits a plate — still
    // ghosts as per-compartment shelves; the overlay is a transient
    // approximation and the exact mesh replaces it.)
    const widthPercent = (label.mode ?? 'text') === 'socket' ? 100 : label.width;
    // Use `label.depth` directly (not clamped to cellD) so the ghost reflects
    // the actual shelf depth the worker would produce. The collision and
    // depth-vs-compartment guards below silently drop tabs that won't fit.
    const tabDepth = label.depth;
    const alignment = label.alignment;
    const inset = label.inset ?? 0;
    const edges = label.edges ?? 'back';
    const includeBack = edges === 'back' || edges === 'both';
    const includeFront = edges === 'front' || edges === 'both';

    // Precompute the set of compartments whose front tab would collide with
    // its back tab when `edges='both'`. Mirrors `findCollidingFrontCompartments`
    // in labelTabBuilder.ts. Without this, the preview would show a front tab
    // the worker silently drops — a real ghost/output mismatch (#1904 review).
    const collidingFrontIds = new Set<number>();
    if (edges === 'both') {
      const visited = new Set<number>();
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cellId = cells[row * cols + col];
          if (visited.has(cellId)) continue;
          visited.add(cellId);
          const bounds = getCompartmentBounds(compartments, cellId);
          if (!bounds) continue;
          const hasFrontAnchor =
            bounds.minRow === 0 || cells[(bounds.minRow - 1) * cols + bounds.minCol] !== cellId;
          const hasBackAnchor =
            bounds.maxRow === rows - 1 ||
            cells[(bounds.maxRow + 1) * cols + bounds.minCol] !== cellId;
          if (!hasFrontAnchor || !hasBackAnchor) continue;
          const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
          if (2 * tabDepth + 2 * inset > compartmentDepth) {
            collidingFrontIds.add(cellId);
          }
        }
      }
    }

    const matrices: THREE.Matrix4[] = [];

    // Build per-row tab quads for one anchor (back or front). Mirrors the
    // worker-side grouping in `labelTabBuilder.ts` — both must stay in sync
    // so the ghost overlay matches the eventual BREP output.
    const buildAnchorRow = (row: number, anchor: 'back' | 'front') => {
      const depthSign = anchor === 'back' ? -1 : 1;
      const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
      const neighborRowOffset = anchor === 'back' ? 1 : -1;
      const hasTiltedAnchorWall =
        anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;

      let col = 0;
      while (col < cols) {
        const cellId = cells[row * cols + col];
        const neighborCellId = isOuterEdgeRow
          ? undefined
          : cells[(row + neighborRowOffset) * cols + col];

        const hasEdge = isOuterEdgeRow || cellId !== neighborCellId;
        if (!hasEdge) {
          col++;
          continue;
        }

        // Mirror the worker's suppression rules so the ghost stays in sync
        // with what will actually be generated (#1904 review).
        if (hasTiltedAnchorWall(compartments, cellId)) {
          col++;
          continue;
        }
        if (anchor === 'front' && collidingFrontIds.has(cellId)) {
          col++;
          continue;
        }

        // Per-compartment depth guard: if the tab body + inset would exceed
        // the compartment depth, the worker drops the tab silently. Match.
        const bounds = getCompartmentBounds(compartments, cellId);
        if (bounds) {
          const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
          if (tabDepth + inset > compartmentDepth) {
            col++;
            continue;
          }
        }

        // Find extent of consecutive same-compId columns with edges
        let groupEnd = col + 1;
        while (groupEnd < cols) {
          const gCellId = cells[row * cols + groupEnd];
          const gNeighborCellId = isOuterEdgeRow
            ? undefined
            : cells[(row + neighborRowOffset) * cols + groupEnd];
          if (gCellId !== cellId || !(isOuterEdgeRow || gCellId !== gNeighborCellId)) break;
          groupEnd++;
        }

        const groupCols = groupEnd - col;
        const groupMinCol = col;
        const groupMaxCol = groupEnd - 1;

        // Compute available width — deduct thickness only at actual divider boundaries
        const groupLeft = -innerW / 2 + groupMinCol * cellW;
        const groupRight = groupLeft + groupCols * cellW;

        const leftDeduction =
          groupMinCol > 0 && cells[row * cols + (groupMinCol - 1)] !== cellId ? thickness / 2 : 0;
        const rightDeduction =
          groupMaxCol < cols - 1 && cells[row * cols + (groupMaxCol + 1)] !== cellId
            ? thickness / 2
            : 0;

        const availableLeft = groupLeft + leftDeduction;
        const availableRight = groupRight - rightDeduction;
        const availableWidth = availableRight - availableLeft;

        const tabWidth = (availableWidth * widthPercent) / 100;
        if (tabWidth <= 0) {
          col = groupEnd;
          continue;
        }

        let tabXStart: number;
        if (alignment === 'left') {
          tabXStart = availableLeft;
        } else if (alignment === 'right') {
          tabXStart = availableRight - tabWidth;
        } else {
          const availableCenter = (availableLeft + availableRight) / 2;
          tabXStart = availableCenter - tabWidth / 2;
        }

        const anchorY =
          anchor === 'back' ? -innerD / 2 + (row + 1) * cellD : -innerD / 2 + row * cellD;
        const positionY = anchorY + depthSign * inset;
        const centerY = positionY + depthSign * (tabDepth / 2);

        const matrix = new THREE.Matrix4();
        matrix.makeScale(tabWidth, tabDepth, 1);
        matrix.setPosition(tabXStart + tabWidth / 2, centerY, 0);
        matrices.push(matrix);

        col = groupEnd;
      }
    };

    for (let row = 0; row < rows; row++) {
      if (includeBack) buildAnchorRow(row, 'back');
      if (includeFront) buildAnchorRow(row, 'front');
    }

    if (matrices.length === 0) return null;

    // Merge all quads into a single BufferGeometry
    const plane = new THREE.PlaneGeometry(1, 1);
    const merged = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allIndices: number[] = [];

    const basePositions = plane.getAttribute('position');
    const baseIndex = plane.getIndex();
    if (!baseIndex) {
      plane.dispose();
      return null;
    }

    for (let i = 0; i < matrices.length; i++) {
      const offset = i * basePositions.count;

      // Transform each vertex by the matrix
      for (let v = 0; v < basePositions.count; v++) {
        const vec = new THREE.Vector3(
          basePositions.getX(v),
          basePositions.getY(v),
          basePositions.getZ(v)
        );
        vec.applyMatrix4(matrices[i]);
        allPositions.push(vec.x, vec.y, vec.z);
      }

      for (let j = 0; j < baseIndex.count; j++) {
        allIndices.push(baseIndex.array[j] + offset);
      }
    }

    plane.dispose();

    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    merged.setIndex(allIndices);

    return merged;
  }, [
    shouldShow,
    innerW,
    innerD,
    cols,
    rows,
    thickness,
    cells,
    compartments,
    label.width,
    label.mode,
    label.depth,
    label.alignment,
    label.edges,
    label.inset,
  ]);

  const material = useMemo(() => {
    if (!shouldShow) return null;

    return new THREE.MeshBasicMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: GHOST_OPACITY,
      side: THREE.DoubleSide,
      depthTest: true,
    });
  }, [shouldShow]);

  // Dispose resources on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  // Invalidate frame when geometry changes
  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  if (!geometry || !material) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0, shelfTopWorldZ + 0.2]}
      renderOrder={2}
    />
  );
}
