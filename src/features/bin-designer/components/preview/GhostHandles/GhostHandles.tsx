/**
 * Renders ghost handle ledge planes in the 3D preview during mesh regeneration.
 *
 * Shows translucent cyan quads at the top of each enabled handle wall where
 * handle ledges will appear. Provides immediate visual feedback when the user
 * changes handle width, depth, or per-wall toggles.
 *
 * Position math mirrors handleBuilder.ts buildHandles.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { HandleWallSide } from '@/features/bin-designer/types';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';

const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.4;

/** Minimum shelf thickness for FDM printability (mm) — mirrors handleBuilder.ts */
const MIN_SHELF_THICKNESS = 2.0;

interface WallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly depthSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

export function GhostHandles() {
  const { invalidate } = useThree();

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { width, depth, height, wallThickness, style, handles, label, base } = params;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  const isFlat = base.style === 'flat';
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const hasLip = base.stackingLip;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER);
  const shelfThickness = Math.max(wallThickness, MIN_SHELF_THICKNESS);

  const shouldShow =
    handles.enabled &&
    style !== 'slotted' &&
    style !== 'solid' &&
    generationStatus === 'generating';

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const walls: readonly WallDef[] = [
      { side: 'front', wallSpan: innerW, depthSpan: innerD, x: 0, y: -innerD / 2, rotateZ: 180 },
      { side: 'back', wallSpan: innerW, depthSpan: innerD, x: 0, y: innerD / 2, rotateZ: 0 },
      { side: 'left', wallSpan: innerD, depthSpan: innerW, x: -innerW / 2, y: 0, rotateZ: 90 },
      { side: 'right', wallSpan: innerD, depthSpan: innerW, x: innerW / 2, y: 0, rotateZ: 270 },
    ];

    const matrices: THREE.Matrix4[] = [];

    for (const wall of walls) {
      if (!handles[wall.side].enabled) continue;

      // Back-wall suppression: skip back handle when label tabs are active
      if (wall.side === 'back' && label.enabled) continue;

      const effectiveDepth = Math.min(handles.depth, wall.depthSpan / 2 - wallThickness);
      if (effectiveDepth <= 0) continue;

      const handleWidth = wall.wallSpan * (handles.width / 100);
      if (handleWidth <= 0) continue;

      // Build a transform that places a unit plane as the shelf quad:
      // 1. Scale to handleWidth x effectiveDepth
      // 2. Position at wall center, shelf extends inward (-Y in local space)
      // 3. Rotate to wall orientation

      const matrix = new THREE.Matrix4();

      // Scale the unit plane
      const scaleMatrix = new THREE.Matrix4().makeScale(handleWidth, effectiveDepth, 1);

      // The shelf center in local space (before rotation):
      // X = 0 (centered on wall), Y = -effectiveDepth/2 (inward from wall face)
      const localX = 0;
      const localY = -effectiveDepth / 2;

      // Rotate the local offset to world orientation
      const angle = (wall.rotateZ * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const worldX = wall.x + localX * cos - localY * sin;
      const worldY = wall.y + localX * sin + localY * cos;

      // Compose: scale, then rotate around Z, then translate
      const rotateMatrix = new THREE.Matrix4().makeRotationZ(angle);
      const translateMatrix = new THREE.Matrix4().makeTranslation(worldX, worldY, 0);

      matrix.multiplyMatrices(translateMatrix, rotateMatrix);
      matrix.multiply(scaleMatrix);

      matrices.push(matrix);
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
  }, [shouldShow, innerW, innerD, wallThickness, handles, label.enabled]);

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

  // Z position: shelf top at interiorHeight, offset by socket height for world space.
  // interiorHeight is relative to bin floor; socket height raises it to world Z.
  const socketZ = isFlat ? 0 : GRIDFINITY.SOCKET_HEIGHT;
  const shelfZ = socketZ + interiorHeight - shelfThickness + 0.2;

  return <mesh geometry={geometry} material={material} position={[0, 0, shelfZ]} renderOrder={2} />;
}
