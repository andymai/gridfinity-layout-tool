/**
 * Renders ghost divider lines in the 3D preview during compartment changes.
 *
 * Shows translucent lines at the top of where compartment walls will appear
 * while the mesh is being regenerated. This provides immediate visual feedback
 * when the user changes rows/columns without waiting for full mesh generation.
 *
 * Only renders during generation or when compartments > 1x1 grid.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Ghost line color (semi-transparent accent) */
const GHOST_COLOR = '#6366f1';
const GHOST_OPACITY = 0.5;

export function GhostDividers() {
  const { invalidate } = useThree();

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { width, depth, height, wallThickness, compartments } = params;
  const { cols, rows } = compartments;

  // Calculate bin dimensions
  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const floorZ = GRIDFINITY.BASE_HEIGHT;
  const wallHeight = totalH - floorZ;
  const topZ = floorZ + wallHeight;

  // Only show during generation or when there are actual dividers
  const shouldShow = (cols > 1 || rows > 1) && generationStatus === 'generating';

  // Create line geometry for ghost dividers
  const geometry = useMemo(() => {
    if (!shouldShow || (cols <= 1 && rows <= 1)) return null;

    const points: number[] = [];
    const cellW = innerW / cols;
    const cellD = innerD / rows;

    // Vertical divider lines (between columns) - top edges only
    for (let col = 1; col < cols; col++) {
      const x = -innerW / 2 + col * cellW;
      // Draw line from front to back at top Z
      points.push(x, -innerD / 2, topZ, x, innerD / 2, topZ);
    }

    // Horizontal divider lines (between rows) - top edges only
    for (let row = 1; row < rows; row++) {
      const y = -innerD / 2 + row * cellD;
      // Draw line from left to right at top Z
      points.push(-innerW / 2, y, topZ, innerW / 2, y, topZ);
    }

    if (points.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [shouldShow, cols, rows, innerW, innerD, topZ]);

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
    <lineSegments geometry={geometry} position={[0, 0, 0.1]} renderOrder={2}>
      <lineBasicMaterial
        color={GHOST_COLOR}
        transparent
        opacity={GHOST_OPACITY}
        depthTest={true}
      />
    </lineSegments>
  );
}
