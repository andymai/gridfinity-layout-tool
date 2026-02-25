/**
 * Renders ghost slot position lines in the 3D preview during mesh regeneration.
 *
 * Shows translucent amber line segments at each slot position on opposing walls.
 * Provides immediate visual feedback when slot parameters change.
 *
 * Pattern matches GhostDividers.tsx (LineSegments2 with LineMaterial).
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
import {
  calculateSlotPositions,
  getEffectiveSlotDimensions,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
const LINE_WIDTH = 2;

export function GhostSlotLines() {
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

  const { width, depth, height, wallThickness, style, slotConfig, dividerPieces } = params;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const topZ = totalH;

  const hasLip = params.base.stackingLip;
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const lipOverhang = hasLip ? Math.max(0, lipTaperWidth - wallThickness) : 0;

  const shouldShow =
    style === 'slotted' &&
    wallThickness >= MIN_WALL_FOR_SLOTS &&
    generationStatus === 'generating' &&
    (slotConfig.x.enabled || slotConfig.y.enabled);

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const positions: number[] = [];
    const { slotDepth } = getEffectiveSlotDimensions(
      wallThickness,
      dividerPieces.thickness,
      dividerPieces.clearance
    );

    // X-axis slots on left/right walls
    if (slotConfig.x.enabled) {
      const yPositions = calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang);
      for (const yPos of yPositions) {
        // Left wall: short line segment perpendicular to wall
        positions.push(-innerW / 2 - slotDepth, yPos, topZ, -innerW / 2, yPos, topZ);
        // Right wall
        positions.push(innerW / 2, yPos, topZ, innerW / 2 + slotDepth, yPos, topZ);
      }
    }

    // Y-axis slots on front/back walls
    if (slotConfig.y.enabled) {
      const xPositions = calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang);
      for (const xPos of xPositions) {
        // Front wall
        positions.push(xPos, -innerD / 2 - slotDepth, topZ, xPos, -innerD / 2, topZ);
        // Back wall
        positions.push(xPos, innerD / 2, topZ, xPos, innerD / 2 + slotDepth, topZ);
      }
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [
    shouldShow,
    slotConfig,
    innerW,
    innerD,
    wallThickness,
    topZ,
    lipOverhang,
    dividerPieces.thickness,
    dividerPieces.clearance,
  ]);

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

  // Keep materialRef in sync via effect (not during render)
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
