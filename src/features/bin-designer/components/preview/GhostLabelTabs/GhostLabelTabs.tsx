/**
 * Renders ghost label tab shelf planes in the 3D preview during mesh regeneration.
 *
 * Shows translucent amber quads at the top of each compartment's back edge where
 * label tabs will appear. Provides immediate visual feedback when the user changes
 * label tab width, depth, alignment, or support style.
 *
 * Position math mirrors replicadBin.ts buildLabelTabs (lines 609-641).
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

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { width, depth, height, wallThickness, style, compartments, label } = params;
  const { cols, rows, thickness, cells } = compartments;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
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

    for (let col = 0; col < cols; col++) {
      // Available width within this column (accounting for divider walls)
      let availableWidth = cellW;
      if (cols > 1) {
        if (col === 0 || col === cols - 1) {
          availableWidth -= thickness / 2;
        } else {
          availableWidth -= thickness;
        }
      }

      const tabWidth = (availableWidth * widthPercent) / 100;
      if (tabWidth <= 0) continue;

      // X center of this column
      const colXCenter = -innerW / 2 + col * cellW + cellW / 2;

      // X offset based on alignment
      let tabXStart: number;
      if (alignment === 'left') {
        const colLeft = colXCenter - availableWidth / 2;
        tabXStart = colLeft;
      } else if (alignment === 'right') {
        const colRight = colXCenter + availableWidth / 2;
        tabXStart = colRight - tabWidth;
      } else {
        tabXStart = colXCenter - tabWidth / 2;
      }

      for (let row = 0; row < rows; row++) {
        const isLastRow = row === rows - 1;
        const cellId = cells[row * cols + col];
        const nextCellId = isLastRow ? undefined : cells[(row + 1) * cols + col];

        // Tab goes here if this is the back wall or a divider exists behind this cell
        if (!isLastRow && cellId === nextCellId) continue;

        const backEdgeY = -innerD / 2 + (row + 1) * cellD;

        const matrix = new THREE.Matrix4();
        matrix.makeScale(tabWidth, tabDepth, 1);
        matrix.setPosition(tabXStart + tabWidth / 2, backEdgeY - tabDepth / 2, 0);
        matrices.push(matrix);
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
