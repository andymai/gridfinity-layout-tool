/**
 * Renders ghost wireframe outline during bin dimension changes.
 *
 * Shows a translucent box outline representing the target bin dimensions
 * while the mesh is being regenerated. This provides immediate visual feedback
 * when the user changes width, depth, or height.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Ghost line color (semi-transparent accent) */
const GHOST_COLOR = '#6366f1';
const GHOST_OPACITY = 0.6;

export function GhostWireframe() {
  const { invalidate } = useThree();

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { width, depth, height } = params;

  // Calculate bin dimensions
  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;

  // Only show during generation
  const shouldShow = generationStatus === 'generating';

  // Create wireframe box geometry
  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const points: number[] = [];
    const halfW = outerW / 2;
    const halfD = outerD / 2;

    // Bottom rectangle (Z = 0)
    points.push(
      -halfW,
      -halfD,
      0,
      halfW,
      -halfD,
      0,
      halfW,
      -halfD,
      0,
      halfW,
      halfD,
      0,
      halfW,
      halfD,
      0,
      -halfW,
      halfD,
      0,
      -halfW,
      halfD,
      0,
      -halfW,
      -halfD,
      0
    );

    // Top rectangle (Z = totalH)
    points.push(
      -halfW,
      -halfD,
      totalH,
      halfW,
      -halfD,
      totalH,
      halfW,
      -halfD,
      totalH,
      halfW,
      halfD,
      totalH,
      halfW,
      halfD,
      totalH,
      -halfW,
      halfD,
      totalH,
      -halfW,
      halfD,
      totalH,
      -halfW,
      -halfD,
      totalH
    );

    // Vertical edges (corners)
    points.push(
      -halfW,
      -halfD,
      0,
      -halfW,
      -halfD,
      totalH,
      halfW,
      -halfD,
      0,
      halfW,
      -halfD,
      totalH,
      halfW,
      halfD,
      0,
      halfW,
      halfD,
      totalH,
      -halfW,
      halfD,
      0,
      -halfW,
      halfD,
      totalH
    );

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [shouldShow, outerW, outerD, totalH]);

  // Dispose geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  // Invalidate frame when geometry changes
  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} position={[0, 0, 0.1]} renderOrder={3}>
      <lineBasicMaterial color={GHOST_COLOR} transparent opacity={GHOST_OPACITY} depthTest={true} />
    </lineSegments>
  );
}
