/**
 * Renders ghost wireframe outline during bin dimension changes.
 *
 * Shows a translucent box outline representing the target bin dimensions
 * while the mesh is being regenerated. This provides immediate visual feedback
 * when the user changes width, depth, or height.
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
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useLineMaterialResolution } from '../useLineMaterialResolution';

/** Ghost line color (matches selection ring yellow used in 2D grid editor) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.85;
/** Line width in pixels */
const LINE_WIDTH = 2;

export function GhostWireframe() {
  const { invalidate } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);

  const { width, depth, height, gridUnitMm, gridUnitMmY, heightUnitMm, generationStatus } =
    useDesignerStore(
      useShallow((s) => ({
        width: s.params.width,
        depth: s.params.depth,
        height: s.params.height,
        gridUnitMm: s.params.gridUnitMm,
        gridUnitMmY: s.params.gridUnitMmY,
        heightUnitMm: s.params.heightUnitMm,
        generationStatus: s.generation.status,
      }))
    );

  // Calculate bin dimensions (Y uses gridUnitMmY for non-square grids)
  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const totalH = height * heightUnitMm;

  // Only show during generation
  const shouldShow = generationStatus === 'generating';

  // Create geometry with line segments
  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const positions: number[] = [];
    const halfW = outerW / 2;
    const halfD = outerD / 2;

    // Bottom rectangle (Z = 0)
    positions.push(
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
    positions.push(
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
    positions.push(
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

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, outerW, outerD, totalH]);

  // Create material (resolution set via effect — avoids recreating on resize)
  const material = useMemo(() => {
    if (!shouldShow) return null;

    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthTest: true,
      resolution: new THREE.Vector2(),
    });
  }, [shouldShow]);

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

  return <primitive ref={lineRef} object={lineSegments} position={[0, 0, 0.1]} renderOrder={3} />;
}
