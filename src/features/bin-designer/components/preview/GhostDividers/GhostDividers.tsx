/**
 * Renders ghost divider lines in the 3D preview during compartment changes.
 *
 * Shows translucent lines at the top of where compartment walls will appear
 * while the mesh is being regenerated. This provides immediate visual feedback
 * when the user changes rows/columns without waiting for full mesh generation.
 *
 * Uses Line2 for proper line width support across WebGL implementations.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Ghost line color (matches selection ring yellow used in 2D grid editor) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
/** Line width in pixels */
const LINE_WIDTH = 2;

export function GhostDividers() {
  const { invalidate } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);

  const {
    width,
    depth,
    height,
    gridUnitMm, gridUnitMmY,
    heightUnitMm,
    wallThickness,
    cols,
    rows,
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
      cols: s.params.compartments.cols,
      rows: s.params.compartments.rows,
      generationStatus: s.generation.status,
    }))
  );

  // Calculate bin dimensions
  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * heightUnitMm;
  const floorZ = GRIDFINITY.BASE_HEIGHT;
  const wallHeight = totalH - floorZ;
  const topZ = floorZ + wallHeight;

  // Only show during generation or when there are actual dividers
  const shouldShow = (cols > 1 || rows > 1) && generationStatus === 'generating';

  // Create line geometry for ghost dividers
  const geometry = useMemo(() => {
    if (!shouldShow || (cols <= 1 && rows <= 1)) return null;

    const positions: number[] = [];
    const cellW = innerW / cols;
    const cellD = innerD / rows;

    // Vertical divider lines (between columns) - top edges only
    for (let col = 1; col < cols; col++) {
      const x = -innerW / 2 + col * cellW;
      // Draw line from front to back at top Z
      positions.push(x, -innerD / 2, topZ, x, innerD / 2, topZ);
    }

    // Horizontal divider lines (between rows) - top edges only
    for (let row = 1; row < rows; row++) {
      const y = -innerD / 2 + row * cellD;
      // Draw line from left to right at top Z
      positions.push(-innerW / 2, y, topZ, innerW / 2, y, topZ);
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, cols, rows, innerW, innerD, topZ]);

  // Create material (resolution set via effect — avoids recreating on resize)
  const material = useMemo(() => {
    if (!shouldShow || (cols <= 1 && rows <= 1)) return null;

    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthTest: true,
      resolution: new THREE.Vector2(),
    });
  }, [shouldShow, cols, rows]);

  useLineMaterialResolution(material);

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

  const lineSegments = useMemo(
    () => (geometry && material ? new LineSegments2(geometry, material) : null),
    [geometry, material]
  );

  if (!lineSegments) return null;

  return <primitive ref={lineRef} object={lineSegments} position={[0, 0, 0.1]} renderOrder={2} />;
}
