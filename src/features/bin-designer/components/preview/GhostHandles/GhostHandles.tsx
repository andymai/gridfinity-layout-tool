/**
 * Renders ghost handle hole outlines in the 3D preview during mesh regeneration.
 *
 * Shows translucent cyan rectangles on wall faces where handle holes will be cut.
 * Position math mirrors handleBuilder.ts buildHandleHoles.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import {
  HOLE_VERTICAL_CENTER,
  buildHandleWallDefs,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';

const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.4;

export function GhostHandles() {
  const { invalidate } = useThree();
  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const {
    width,
    depth,
    height,
    wallThickness,
    style,
    handles,
    label,
    base,
    walls: wallConfig,
  } = params;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  const isFlat = base.style === 'flat';
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const hasLip = base.stackingLip;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER);

  const shouldShow =
    handles.enabled &&
    style !== 'slotted' &&
    style !== 'solid' &&
    generationStatus === 'generating';

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    // Clamp hole height to stay within wall bounds around centerZ
    const centerZ = interiorHeight * HOLE_VERTICAL_CENTER;
    const margin = interiorHeight * 0.1;
    const maxHalfHeight = Math.max(0, Math.min(centerZ, interiorHeight - centerZ) - margin);
    const effectiveHeight = Math.min(handles.height, maxHalfHeight * 2);
    if (effectiveHeight < 1) return null;

    const wallDefs = buildHandleWallDefs(innerW, innerD);
    const matrices: THREE.Matrix4[] = [];

    for (const wall of wallDefs) {
      if (!handles[wall.side].enabled) continue;
      if (wall.side === 'back' && label.enabled) continue;

      const wallCutout = wallConfig.enabled ? wallConfig[wall.side] : undefined;
      const segments = computeWallHandleSegments(
        wall.wallSpan,
        handles.width,
        wallThickness,
        wallCutout
      );
      if (!segments) continue;

      for (const seg of segments) {
        const matrix = new THREE.Matrix4();
        // After plane.rotateX(pi/2), vertical extent is Z not Y
        const scaleMatrix = new THREE.Matrix4().makeScale(seg.width, 1, effectiveHeight);

        const angle = (wall.rotateZ * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const worldX = wall.x + seg.offset * cos;
        const worldY = wall.y + seg.offset * sin;

        const rotateMatrix = new THREE.Matrix4().makeRotationZ(angle);
        const translateMatrix = new THREE.Matrix4().makeTranslation(worldX, worldY, 0);

        matrix.multiplyMatrices(translateMatrix, rotateMatrix);
        matrix.multiply(scaleMatrix);
        matrices.push(matrix);
      }
    }

    if (matrices.length === 0) return null;

    // Pre-rotate plane from XY into XZ so it lies on vertical wall faces
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(Math.PI / 2);
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
  }, [
    shouldShow,
    innerW,
    innerD,
    wallThickness,
    handles,
    label.enabled,
    wallConfig,
    interiorHeight,
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

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  if (!geometry || !material) return null;

  const socketZ = isFlat ? 0 : GRIDFINITY.SOCKET_HEIGHT;
  const holeZ = socketZ + interiorHeight * HOLE_VERTICAL_CENTER;

  return <mesh geometry={geometry} material={material} position={[0, 0, holeZ]} renderOrder={2} />;
}
