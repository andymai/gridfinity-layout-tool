/**
 * Ghost divider lines shown during mesh generation.
 *
 * When compartment rows/columns change, immediately shows where the
 * divider walls will be positioned before the mesh regenerates.
 * Uses the same ghost styling as GhostWireframe.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useDesignerStore } from '@/features/bin-designer/store';

/** Ghost line color - matches GhostWireframe */
const GHOST_COLOR = '#a0a8b0';

/** Wall thickness assumed for interior offset */
const DEFAULT_WALL_THICKNESS = 1.2;

/**
 * Ghost divider lines for compartment preview.
 * Shows grid lines where divider walls will be placed.
 */
export function GhostDividers() {
  const { width, depth, height, cols, rows, ghostPhase, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      cols: s.params.compartments.cols,
      rows: s.params.compartments.rows,
      ghostPhase: s.generation.ghostTransition.phase,
      generationStatus: s.generation.status,
    }))
  );

  // Only show during generation or when ghost is showing
  const isVisible = ghostPhase === 'showing' || generationStatus === 'generating';

  // Calculate bin dimensions
  const outerW = width * GRIDFINITY.GRID_SIZE;
  const outerD = depth * GRIDFINITY.GRID_SIZE;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const floorZ = GRIDFINITY.BASE_HEIGHT; // Height of base socket

  // Interior dimensions (where dividers go)
  const innerW = outerW - 2 * DEFAULT_WALL_THICKNESS;
  const innerD = outerD - 2 * DEFAULT_WALL_THICKNESS;
  const wallHeight = totalH - GRIDFINITY.BASE_HEIGHT;

  // Cell dimensions
  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Create line geometry for dividers (top lines only for clarity)
  const geometry = useMemo(() => {
    // Skip if no dividers needed
    if (cols <= 1 && rows <= 1) return null;

    const points: number[] = [];
    const topZ = floorZ + wallHeight;

    // Vertical dividers (along Y axis, between columns)
    for (let col = 1; col < cols; col++) {
      const x = -innerW / 2 + col * cellW;
      points.push(x, -innerD / 2, topZ, x, innerD / 2, topZ);
    }

    // Horizontal dividers (along X axis, between rows)
    for (let row = 1; row < rows; row++) {
      const y = -innerD / 2 + row * cellD;
      points.push(-innerW / 2, y, topZ, innerW / 2, y, topZ);
    }

    if (points.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [cols, rows, innerW, innerD, cellW, cellD, floorZ, wallHeight]);

  if (!isVisible || !geometry) return null;

  return (
    <lineSegments geometry={geometry} position={[0, 0, 0.1]}>
      <lineBasicMaterial color={GHOST_COLOR} transparent opacity={0.6} />
    </lineSegments>
  );
}
