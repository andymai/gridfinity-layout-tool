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

    const ARC_SEGMENTS = 16;
    const FUNNEL_TAPER = 0.6;

    // Helper: push a line segment in the correct axis orientation
    const pushLine = (
      axis: 'front-back' | 'left-right',
      cx: number,
      cy: number,
      localX0: number,
      localZ0: number,
      localX1: number,
      localZ1: number
    ) => {
      if (axis === 'front-back') {
        positions.push(cx + localX0, cy, localZ0, cx + localX1, cy, localZ1);
      } else {
        positions.push(cy, cx + localX0, localZ0, cy, cx + localX1, localZ1);
      }
    };

    // U-notch outline: bottom + two sides, open at top
    const addUNotch = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right'
    ) => {
      const z0 = cz - hh;
      const z1 = cz + hh;
      pushLine(axis, cx, cy, -hw, z0, hw, z0); // Bottom
      pushLine(axis, cx, cy, hw, z0, hw, z1); // Right side
      pushLine(axis, cx, cy, -hw, z0, -hw, z1); // Left side
    };

    // Scoop outline: semicircle arc + two sides to top
    const addScoop = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right'
    ) => {
      const topZ = cz + hh;
      const sagitta = Math.min(hw, hh); // Clamp arc depth to floor boundary
      // Circular segment: compute radius from chord (2*hw) and sagitta
      const chord = 2 * hw;
      const r = sagitta / 2 + (chord * chord) / (8 * sagitta);
      const arcTopZ = topZ; // Where the arc starts (top of cutout)
      // Draw arc from right to left (angles relative to circle center)
      // Circle center is at (0, arcTopZ + r - sagitta) relative to cx/cz
      const circleCenterZ = arcTopZ - sagitta + r;
      for (let i = 0; i < ARC_SEGMENTS; i++) {
        // Angle from right edge to left edge
        const halfAngle = Math.asin(hw / r);
        const a0 = -Math.PI / 2 - halfAngle + (2 * halfAngle * i) / ARC_SEGMENTS;
        const a1 = -Math.PI / 2 - halfAngle + (2 * halfAngle * (i + 1)) / ARC_SEGMENTS;
        const x0 = Math.cos(a0) * r;
        const z0 = circleCenterZ + Math.sin(a0) * r;
        const x1 = Math.cos(a1) * r;
        const z1 = circleCenterZ + Math.sin(a1) * r;
        pushLine(axis, cx, cy, x0, z0, x1, z1);
      }
    };

    // Funnel outline: tapered sides + bottom, open at top
    const addFunnel = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right'
    ) => {
      const z0 = cz - hh;
      const z1 = cz + hh;
      const bottomHW = hw * FUNNEL_TAPER;
      pushLine(axis, cx, cy, -bottomHW, z0, bottomHW, z0); // Bottom
      pushLine(axis, cx, cy, hw, z1, bottomHW, z0); // Right taper
      pushLine(axis, cx, cy, -hw, z1, -bottomHW, z0); // Left taper
    };

    const addOutline = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right'
    ) => {
      switch (walls.shape) {
        case 'scoop':
          return addScoop(cx, cy, cz, hw, hh, axis);
        case 'funnel':
          return addFunnel(cx, cy, cz, hw, hh, axis);
        default:
          return addUNotch(cx, cy, cz, hw, hh, axis);
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
      const userCutH = wallHeight * (effectiveDepth / 100);
      if (cutW < 0.1 || userCutH < 0.1) continue;

      // Ghost Z is in final mesh coordinates (translated up by SOCKET_HEIGHT).
      // Only show the user-visible portion (bottom of U-notch), not the overshoot.
      const topZ = totalH;
      const cutCenterZ = topZ - userCutH / 2;

      addOutline(side.cx, side.cy, cutCenterZ, cutW / 2, userCutH / 2, side.axis);
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
