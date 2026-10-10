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
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';

/** Ghost line color (matches selection ring yellow used in 2D grid editor) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
/** Line width in pixels */
const LINE_WIDTH = 2;

export function GhostDividers() {
  const { params, height, heightUnitMm, cols, rows, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      height: s.params.height,
      heightUnitMm: s.params.heightUnitMm,
      cols: s.params.compartments.cols,
      rows: s.params.compartments.rows,
      generationStatus: s.generation.status,
    }))
  );

  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
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
    const left = offsetX - innerW / 2;
    const front = offsetY - innerD / 2;

    // Vertical divider lines (between columns) - top edges only
    for (let col = 1; col < cols; col++) {
      const x = left + col * cellW;
      // Draw line from front to back at top Z
      positions.push(x, front, topZ, x, front + innerD, topZ);
    }

    // Horizontal divider lines (between rows) - top edges only
    for (let row = 1; row < rows; row++) {
      const y = front + row * cellD;
      // Draw line from left to right at top Z
      positions.push(left, y, topZ, left + innerW, y, topZ);
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, cols, rows, innerW, innerD, offsetX, offsetY, topZ]);

  const lineSegments = useGhostLineSegments(geometry, {
    color: GHOST_COLOR,
    opacity: GHOST_OPACITY,
    lineWidth: LINE_WIDTH,
  });

  if (!lineSegments) return null;

  return <primitive object={lineSegments} position={[0, 0, 0.1]} renderOrder={2} />;
}
