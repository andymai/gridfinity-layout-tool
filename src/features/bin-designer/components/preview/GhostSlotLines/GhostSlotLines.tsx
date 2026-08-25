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
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  calculateSlotPositions,
  dividerInterior,
  getEffectiveSlotDimensions,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
const LINE_WIDTH = 2;

export function GhostSlotLines() {
  const { invalidate } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);

  const {
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    wallThickness,
    style,
    slotConfig,
    dividerPieces,
    hasLip,
    generationStatus,
    overhang,
    cellMask,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      heightUnitMm: s.params.heightUnitMm,
      wallThickness: s.params.wallThickness,
      style: s.params.style,
      slotConfig: s.params.slotConfig,
      dividerPieces: s.params.dividerPieces,
      hasLip: s.params.base.stackingLip,
      generationStatus: s.generation.status,
      overhang: s.params.overhang,
      cellMask: s.params.cellMask,
    }))
  );

  const { innerW, innerD, offsetX, offsetY } = dividerInterior({
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    overhang,
    cellMask,
  });
  const totalH = height * heightUnitMm;
  const topZ = totalH;
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const lipOverhang = hasLip ? Math.max(0, lipTaperWidth - wallThickness) : 0;

  const shouldShow =
    style === 'slotted' &&
    wallThickness >= MIN_WALL_FOR_SLOTS &&
    generationStatus === 'generating' &&
    // Custom layout draws its own authored overlay (GhostAuthoredDividers);
    // the parametric slot lines would show wrong positions and overlap it.
    slotConfig.layout !== 'custom' &&
    (slotConfig.x.enabled || slotConfig.y.enabled);

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const positions: number[] = [];
    const { slotDepth } = getEffectiveSlotDimensions(
      wallThickness,
      dividerPieces.thickness,
      dividerPieces.clearance
    );

    // Slot positions are relative to the cavity center; an asymmetric overhang
    // moves that center off scene origin, which stays the nominal footprint's.
    const cx = (v: number): number => v + offsetX;
    const cy = (v: number): number => v + offsetY;

    // X-axis slots on left/right walls
    if (slotConfig.x.enabled) {
      const yPositions = calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang);
      for (const yPos of yPositions) {
        // Left wall: short line segment perpendicular to wall
        positions.push(
          cx(-innerW / 2 - slotDepth),
          cy(yPos),
          topZ,
          cx(-innerW / 2),
          cy(yPos),
          topZ
        );
        // Right wall
        positions.push(cx(innerW / 2), cy(yPos), topZ, cx(innerW / 2 + slotDepth), cy(yPos), topZ);
      }
    }

    // Y-axis slots on front/back walls
    if (slotConfig.y.enabled) {
      const xPositions = calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang);
      for (const xPos of xPositions) {
        // Front wall
        positions.push(
          cx(xPos),
          cy(-innerD / 2 - slotDepth),
          topZ,
          cx(xPos),
          cy(-innerD / 2),
          topZ
        );
        // Back wall
        positions.push(cx(xPos), cy(innerD / 2), topZ, cx(xPos), cy(innerD / 2 + slotDepth), topZ);
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
    offsetX,
    offsetY,
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
      resolution: new THREE.Vector2(),
    });
  }, [shouldShow]);

  useLineMaterialResolution(material);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

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
