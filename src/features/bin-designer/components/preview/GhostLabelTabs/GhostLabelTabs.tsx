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

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.45;

export function GhostLabelTabs() {
  const { invalidate } = useThree();

  const {
    width,
    depth,
    height,
    gridUnitMm,
    heightUnitMm,
    wallThickness,
    style,
    compartments,
    label,
    generationStatus,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
      wallThickness: s.params.wallThickness,
      style: s.params.style,
      compartments: s.params.compartments,
      label: s.params.label,
      generationStatus: s.generation.status,
    }))
  );
  const { cols, rows, thickness, cells } = compartments;

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * gridUnitMm - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * heightUnitMm;
  const topZ = totalH;

  const shouldShow =
    label.enabled &&
    style !== 'slotted' &&
    generationStatus === 'generating' &&
    cells.length >= rows * cols;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const cellW = innerW / cols;
    const cellD = innerD / rows;
    const widthPercent = label.width;
    const tabDepth = Math.min(label.depth, cellD);
    const alignment = label.alignment;

    const matrices: THREE.Matrix4[] = [];

    // Iterate per-row, grouping consecutive same-compartment columns that share
    // a back edge. Produces one tab spanning merged columns instead of separate
    // per-column tabs with incorrect divider deductions.
    for (let row = 0; row < rows; row++) {
      const isLastRow = row === rows - 1;
      let col = 0;

      while (col < cols) {
        const cellId = cells[row * cols + col];
        const nextRowCellId = isLastRow ? undefined : cells[(row + 1) * cols + col];

        const hasBackEdge = isLastRow || cellId !== nextRowCellId;
        if (!hasBackEdge) {
          col++;
          continue;
        }

        // Find extent of consecutive same-compId columns with back edges
        let groupEnd = col + 1;
        while (groupEnd < cols) {
          const gCellId = cells[row * cols + groupEnd];
          const gNextRowCellId = isLastRow ? undefined : cells[(row + 1) * cols + groupEnd];
          if (gCellId !== cellId || !(isLastRow || gCellId !== gNextRowCellId)) break;
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

        const backEdgeY = -innerD / 2 + (row + 1) * cellD;

        const matrix = new THREE.Matrix4();
        matrix.makeScale(tabWidth, tabDepth, 1);
        matrix.setPosition(tabXStart + tabWidth / 2, backEdgeY - tabDepth / 2, 0);
        matrices.push(matrix);

        col = groupEnd;
      }
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
    label.width,
    label.depth,
    label.alignment,
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
    <mesh geometry={geometry} material={material} position={[0, 0, topZ + 0.2]} renderOrder={2} />
  );
}
