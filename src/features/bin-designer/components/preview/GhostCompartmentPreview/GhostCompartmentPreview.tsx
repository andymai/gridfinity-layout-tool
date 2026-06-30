/**
 * Renders ghost preview during drag-to-merge/split operations.
 *
 * For merge: Shows a flat amber rectangle covering the selected cells
 * For split: Shows cyan divider lines where walls will appear
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
import { cellIndex } from '@/features/bin-designer/utils/compartments';

/** Amber color for merge preview */
const MERGE_COLOR = '#f59e0b';
const MERGE_OPACITY = 0.4;

/** Cyan color for split preview lines */
const SPLIT_COLOR = '#22d3ee';
const SPLIT_OPACITY = 0.85;
const LINE_WIDTH = 3;

export function GhostCompartmentPreview() {
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
    previewCompartments,
    previewSelection,
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
      previewCompartments: s.ui.previewCompartments,
      previewSelection: s.ui.previewSelection,
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

  const shouldShow = previewSelection !== null;
  const isMerge = previewSelection?.action === 'merge';

  // Create merge preview plane geometry
  const mergePlane = useMemo(() => {
    if (!shouldShow || !isMerge) return null;

    const { minCol, maxCol, minRow, maxRow } = previewSelection;
    const cellW = innerW / cols;
    const cellD = innerD / rows;

    // Calculate rectangle bounds
    const x1 = -innerW / 2 + minCol * cellW;
    const x2 = -innerW / 2 + (maxCol + 1) * cellW;
    const y1 = -innerD / 2 + minRow * cellD;
    const y2 = -innerD / 2 + (maxRow + 1) * cellD;

    const rectW = x2 - x1;
    const rectD = y2 - y1;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    const geo = new THREE.PlaneGeometry(rectW, rectD);
    geo.translate(centerX, centerY, 0);
    return geo;
  }, [shouldShow, isMerge, previewSelection, innerW, innerD, cols, rows]);

  // Create split preview line geometry
  const splitGeometry = useMemo(() => {
    if (!shouldShow || isMerge || !previewCompartments) return null;

    const { cols: pCols, rows: pRows, cells } = previewCompartments;
    if (pCols <= 1 && pRows <= 1) return null;

    const positions: number[] = [];
    const cellW = innerW / pCols;
    const cellD = innerD / pRows;

    // Draw walls between cells with different compartment IDs
    for (let row = 0; row < pRows; row++) {
      for (let col = 0; col < pCols; col++) {
        const idx = cellIndex(pCols, col, row);
        const currentId = cells[idx];

        // Check right neighbor
        if (col < pCols - 1) {
          const rightId = cells[cellIndex(pCols, col + 1, row)];
          if (currentId !== rightId) {
            const x = -innerW / 2 + (col + 1) * cellW;
            const y1 = -innerD / 2 + row * cellD;
            const y2 = -innerD / 2 + (row + 1) * cellD;
            positions.push(x, y1, topZ, x, y2, topZ);
          }
        }

        // Check top neighbor
        if (row < pRows - 1) {
          const topId = cells[cellIndex(pCols, col, row + 1)];
          if (currentId !== topId) {
            const y = -innerD / 2 + (row + 1) * cellD;
            const x1 = -innerW / 2 + col * cellW;
            const x2 = -innerW / 2 + (col + 1) * cellW;
            positions.push(x1, y, topZ, x2, y, topZ);
          }
        }
      }
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, isMerge, previewCompartments, innerW, innerD, topZ]);

  // Create materials
  const mergeMaterial = useMemo(() => {
    if (!shouldShow || !isMerge) return null;
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(MERGE_COLOR),
      transparent: true,
      opacity: MERGE_OPACITY,
      side: THREE.DoubleSide,
      depthTest: true,
    });
  }, [shouldShow, isMerge]);

  const splitMaterial = useMemo(() => {
    if (!shouldShow || isMerge) return null;
    return new LineMaterial({
      color: new THREE.Color(SPLIT_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: SPLIT_OPACITY,
      depthTest: true,
      resolution: new THREE.Vector2(),
    });
  }, [shouldShow, isMerge]);

  useLineMaterialResolution(splitMaterial);

  // Dispose resources
  useEffect(() => {
    return () => {
      mergePlane?.dispose();
      mergeMaterial?.dispose();
      splitGeometry?.dispose();
      splitMaterial?.dispose();
    };
  }, [mergePlane, mergeMaterial, splitGeometry, splitMaterial]);

  // Invalidate frame when geometry changes
  useEffect(() => {
    if ((mergePlane && mergeMaterial) || (splitGeometry && splitMaterial)) {
      invalidate();
    }
  }, [mergePlane, mergeMaterial, splitGeometry, splitMaterial, invalidate]);

  const splitLineSegments = useMemo(
    () => (splitGeometry && splitMaterial ? new LineSegments2(splitGeometry, splitMaterial) : null),
    [splitGeometry, splitMaterial]
  );

  if (!shouldShow) return null;

  // Render merge preview (flat amber plane)
  if (isMerge && mergePlane && mergeMaterial) {
    return (
      <mesh
        geometry={mergePlane}
        material={mergeMaterial}
        position={[0, 0, topZ + 0.5]}
        renderOrder={3}
      />
    );
  }

  // Render split preview (cyan divider lines)
  if (!isMerge && splitLineSegments) {
    return (
      <primitive ref={lineRef} object={splitLineSegments} position={[0, 0, 0.2]} renderOrder={3} />
    );
  }

  return null;
}
