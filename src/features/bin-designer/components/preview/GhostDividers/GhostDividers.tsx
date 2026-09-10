/**
 * Renders ghost divider lines in the 3D preview during compartment changes.
 *
 * Shows translucent lines at the top of where compartment walls will appear
 * while the mesh is being regenerated. This provides immediate visual feedback
 * when the user changes rows/columns without waiting for full mesh generation.
 *
 * Uses Line2 for proper line width support across WebGL implementations.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useGhostLineSegments } from '../useGhostLineSegments';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Ghost line color (matches selection ring yellow used in 2D grid editor) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
/** Line width in pixels */
const LINE_WIDTH = 2;

export function GhostDividers() {
  const {
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmY,
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

  const lineSegments = useGhostLineSegments(geometry, {
    color: GHOST_COLOR,
    opacity: GHOST_OPACITY,
    lineWidth: LINE_WIDTH,
  });

  if (!lineSegments) return null;

  return <primitive object={lineSegments} position={[0, 0, 0.1]} renderOrder={2} />;
}
