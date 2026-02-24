/**
 * Ghost wireframe outline showing the target baseplate dimensions during regeneration.
 *
 * Provides immediate visual feedback when the user changes padding — the ghost
 * outline snaps to the target size instantly while the mesh regenerates in the
 * background. Uses LineSegments2 for crisp lines at any zoom level.
 *
 * Follows the same ghost preview pattern as the bin designer's GhostWireframe.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

/** Ghost line color — matches bin designer ghost wireframe (amber) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.85;
const LINE_WIDTH = 2;

interface GhostPaddingOutlineProps {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly isGenerating: boolean;
}

export function GhostPaddingOutline({
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
  isGenerating,
}: GhostPaddingOutlineProps) {
  const { invalidate, size } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);
  const materialRef = useRef<LineMaterial | null>(null);

  const canvasWidth = size.width;
  const canvasHeight = size.height;

  const gridW = width * gridUnitMm;
  const gridD = depth * gridUnitMm;
  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;

  // Slab edges: pockets centered at origin, slab offset by padding asymmetry
  const slabLeft = -gridW / 2 - paddingLeft;
  const slabRight = gridW / 2 + paddingRight;
  const slabFront = -gridD / 2 - paddingFront;
  const slabBack = gridD / 2 + paddingBack;

  const hasPadding = paddingLeft > 0 || paddingRight > 0 || paddingFront > 0 || paddingBack > 0;
  const shouldShow = isGenerating && hasPadding;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const positions: number[] = [];

    // Bottom rectangle (Z = 0)
    positions.push(
      slabLeft,
      slabFront,
      0,
      slabRight,
      slabFront,
      0,
      slabRight,
      slabFront,
      0,
      slabRight,
      slabBack,
      0,
      slabRight,
      slabBack,
      0,
      slabLeft,
      slabBack,
      0,
      slabLeft,
      slabBack,
      0,
      slabLeft,
      slabFront,
      0
    );

    // Top rectangle (Z = totalH)
    positions.push(
      slabLeft,
      slabFront,
      totalH,
      slabRight,
      slabFront,
      totalH,
      slabRight,
      slabFront,
      totalH,
      slabRight,
      slabBack,
      totalH,
      slabRight,
      slabBack,
      totalH,
      slabLeft,
      slabBack,
      totalH,
      slabLeft,
      slabBack,
      totalH,
      slabLeft,
      slabFront,
      totalH
    );

    // Vertical edges (4 corners)
    positions.push(
      slabLeft,
      slabFront,
      0,
      slabLeft,
      slabFront,
      totalH,
      slabRight,
      slabFront,
      0,
      slabRight,
      slabFront,
      totalH,
      slabRight,
      slabBack,
      0,
      slabRight,
      slabBack,
      totalH,
      slabLeft,
      slabBack,
      0,
      slabLeft,
      slabBack,
      totalH
    );

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, slabLeft, slabRight, slabFront, slabBack, totalH]);

  const material = useMemo(() => {
    if (!shouldShow) return null;

    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthTest: true,
      resolution: new THREE.Vector2(canvasWidth, canvasHeight),
    });
  }, [shouldShow, canvasWidth, canvasHeight]);

  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  // Update resolution on resize
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.resolution.set(canvasWidth, canvasHeight);
    }
  });

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  const lineSegments = useMemo(() => {
    if (!geometry || !material) return null;
    return new LineSegments2(geometry, material);
  }, [geometry, material]);

  if (!lineSegments) return null;

  return <primitive ref={lineRef} object={lineSegments} position={[0, 0, 0.1]} renderOrder={3} />;
}
