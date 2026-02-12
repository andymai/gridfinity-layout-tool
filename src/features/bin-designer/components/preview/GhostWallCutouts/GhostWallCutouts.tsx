/**
 * Renders ghost wall cutout outlines in the 3D preview during mesh regeneration.
 *
 * Shows translucent amber rectangle outlines at each wall cutout position.
 * Provides immediate visual feedback when wall cutout parameters change.
 *
 * Pattern matches GhostSlotLines.tsx (LineSegments2 with LineMaterial).
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
const LINE_WIDTH = 2;

export function GhostWallCutouts() {
  const { invalidate, size } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);
  const materialRef = useRef<LineMaterial | null>(null);

  const canvasWidth = size.width;
  const canvasHeight = size.height;

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { width, depth, height, wallThickness, walls } = params;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;

  const shouldShow = walls.enabled && generationStatus === 'generating';

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const positions: number[] = [];

    // Helper: add a rectangle outline (4 line segments) at a given position
    const addRect = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right'
    ) => {
      // Rectangle corners on wall face
      if (axis === 'front-back') {
        // Wall spans along X, face normal along Y
        const x0 = cx - hw;
        const x1 = cx + hw;
        const z0 = cz - hh;
        const z1 = cz + hh;
        const y = cy;
        // Bottom
        positions.push(x0, y, z0, x1, y, z0);
        // Right
        positions.push(x1, y, z0, x1, y, z1);
        // Top
        positions.push(x1, y, z1, x0, y, z1);
        // Left
        positions.push(x0, y, z1, x0, y, z0);
      } else {
        // Wall spans along Y, face normal along X
        const y0 = cx - hw;
        const y1 = cx + hw;
        const z0 = cz - hh;
        const z1 = cz + hh;
        const x = cy;
        positions.push(x, y0, z0, x, y1, z0);
        positions.push(x, y1, z0, x, y1, z1);
        positions.push(x, y1, z1, x, y0, z1);
        positions.push(x, y0, z1, x, y0, z0);
      }
    };

    const sides: Array<{
      key: 'front' | 'back' | 'left' | 'right';
      wallSpan: number;
      cx: number;
      cy: number;
      axis: 'front-back' | 'left-right';
    }> = [
      { key: 'front', wallSpan: innerW, cx: 0, cy: -innerD / 2, axis: 'front-back' },
      { key: 'back', wallSpan: innerW, cx: 0, cy: innerD / 2, axis: 'front-back' },
      { key: 'left', wallSpan: innerD, cx: 0, cy: -innerW / 2, axis: 'left-right' },
      { key: 'right', wallSpan: innerD, cx: 0, cy: innerW / 2, axis: 'left-right' },
    ];

    for (const side of sides) {
      const sideConfig = walls[side.key];
      const effectiveWidth = sideConfig.enabled ? sideConfig.width : walls.width;
      const effectiveDepth = sideConfig.enabled ? sideConfig.depth : walls.depth;
      if (effectiveWidth <= 0 || effectiveDepth <= 0) continue;

      const cutW = side.wallSpan * (effectiveWidth / 100);
      const cutH = wallHeight * (effectiveDepth / 100);
      if (cutW < 0.1 || cutH < 0.1) continue;

      // Ghost Z is in final mesh coordinates (translated up by SOCKET_HEIGHT)
      const topZ = totalH;
      const cutCenterZ = topZ - cutH / 2;

      addRect(side.cx, side.cy, cutCenterZ, cutW / 2, cutH / 2, side.axis);
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, walls, innerW, innerD, wallHeight, totalH]);

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

  if (!geometry || !material) return null;

  return (
    <primitive
      ref={lineRef}
      object={new LineSegments2(geometry, material)}
      position={[0, 0, 0.1]}
      renderOrder={2}
    />
  );
}
