/**
 * Renders ghost wall cutout outlines in the 3D preview during mesh regeneration.
 *
 * Shows translucent amber rectangle outlines at each wall cutout position.
 * Provides immediate visual feedback when wall cutout parameters change.
 *
 * Pattern matches GhostSlotLines.tsx (LineSegments2 with LineMaterial).
 */

import { useMemo, useEffect, useRef } from 'react';
import { baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  computeCutoutCenter,
  cornerSlackFor,
  resolveCutoutCornerRadii,
  safeCutoutCornerRadii,
  type SafeCornerRadii,
} from '@/shared/utils/wallCutoutPosition';

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.75;
const LINE_WIDTH = 2;

export function GhostWallCutouts() {
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
    walls,
    base,
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
      walls: s.params.walls,
      base: s.params.base,
      generationStatus: s.generation.status,
    }))
  );

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * heightUnitMm;
  const wallHeight = baseWallHeight(base, totalH);

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

    /**
     * A quarter-arc corner, tessellated from `from` to `to` around `centre`.
     *
     * Both radii the panel exposes are quarter arcs against the same pair of
     * axes: the top round-over blends the rim into the cut's side, the bottom
     * fillet blends the side into the floor. Only the quadrant differs.
     */
    const addQuarter = (
      axis: 'front-back' | 'left-right',
      cx: number,
      cy: number,
      centreX: number,
      centreZ: number,
      startAngle: number,
      radius: number
    ) => {
      if (radius <= 0) return;
      for (let i = 0; i < ARC_SEGMENTS; i++) {
        const a0 = startAngle + (Math.PI / 2) * (i / ARC_SEGMENTS);
        const a1 = startAngle + (Math.PI / 2) * ((i + 1) / ARC_SEGMENTS);
        pushLine(
          axis,
          cx,
          cy,
          centreX + Math.cos(a0) * radius,
          centreZ + Math.sin(a0) * radius,
          centreX + Math.cos(a1) * radius,
          centreZ + Math.sin(a1) * radius
        );
      }
    };

    /**
     * The two shoulder blends, drawn on every shape.
     *
     * The cut flares outward as it rises and reaches its full radius exactly
     * at the rim, so the outline has to open there too — otherwise dragging
     * the radius moves nothing on screen until the worker returns.
     */
    const addTopFlares = (
      axis: 'front-back' | 'left-right',
      cx: number,
      cy: number,
      hw: number,
      rimZ: number,
      corner: SafeCornerRadii
    ) => {
      // Each blend is centred a radius outboard of the cut and a radius below
      // the rim, so it lands tangent to the rim above and to the cut's own
      // side below. `addQuarter` sweeps anticlockwise, which puts the right
      // blend in the quadrant from +z round to -x and the left one from +x
      // round to +z — the two are NOT the same start angle mirrored.
      addQuarter(
        axis,
        cx,
        cy,
        hw + corner.topRight,
        rimZ - corner.topRight,
        Math.PI / 2,
        corner.topRight
      );
      addQuarter(axis, cx, cy, -hw - corner.topLeft, rimZ - corner.topLeft, 0, corner.topLeft);
    };

    // U-notch outline: bottom + two sides, open at top
    const addUNotch = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right',
      corner: SafeCornerRadii
    ) => {
      const z0 = cz - hh;
      const z1 = cz + hh;
      pushLine(axis, cx, cy, -hw + corner.bottomLeft, z0, hw - corner.bottomRight, z0); // Bottom
      pushLine(axis, cx, cy, hw, z0 + corner.bottomRight, hw, z1 - corner.topRight); // Right side
      pushLine(axis, cx, cy, -hw, z0 + corner.bottomLeft, -hw, z1 - corner.topLeft); // Left side
      // Bottom fillets sweep from the floor (pointing -z) round to the side.
      addQuarter(
        axis,
        cx,
        cy,
        hw - corner.bottomRight,
        z0 + corner.bottomRight,
        -Math.PI / 2,
        corner.bottomRight
      );
      addQuarter(
        axis,
        cx,
        cy,
        -hw + corner.bottomLeft,
        z0 + corner.bottomLeft,
        Math.PI,
        corner.bottomLeft
      );
      addTopFlares(axis, cx, cy, hw, z1, corner);
    };

    // Scoop outline: semicircle arc + two sides to top
    const addScoop = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right',
      corner: SafeCornerRadii
    ) => {
      addTopFlares(axis, cx, cy, hw, cz + hh, corner);
      // The blend drops the arc's chord by the deeper of the two radii, the
      // same way the profile does, so the outline tracks the solid.
      const topZ = cz + hh - Math.max(corner.topLeft, corner.topRight);
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
      axis: 'front-back' | 'left-right',
      corner: SafeCornerRadii
    ) => {
      const z0 = cz - hh;
      const z1 = cz + hh;
      const bottomHW = hw * FUNNEL_TAPER;
      pushLine(axis, cx, cy, -bottomHW, z0, bottomHW, z0); // Bottom
      pushLine(axis, cx, cy, hw, z1 - corner.topRight, bottomHW, z0); // Right taper
      pushLine(axis, cx, cy, -hw, z1 - corner.topLeft, -bottomHW, z0); // Left taper
      // No bottom fillet here: the taper meets the floor at an oblique angle,
      // so its blend is not the quarter arc `addQuarter` draws, and an outline
      // that is wrong by a visible amount is worse than one that is plainly
      // approximate. The solid still fillets it.
      addTopFlares(axis, cx, cy, hw, z1, corner);
    };

    const addOutline = (
      cx: number,
      cy: number,
      cz: number,
      hw: number,
      hh: number,
      axis: 'front-back' | 'left-right',
      corner: SafeCornerRadii
    ) => {
      switch (walls.shape) {
        case 'scoop':
          return addScoop(cx, cy, cz, hw, hh, axis, corner);
        case 'funnel':
          return addFunnel(cx, cy, cz, hw, hh, axis, corner);
        default:
          return addUNotch(cx, cy, cz, hw, hh, axis, corner);
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
      if (!sideConfig.enabled) continue;
      const effectiveWidth = sideConfig.width;
      const effectiveDepth = sideConfig.depth;
      const effectiveAlignment = sideConfig.alignment;
      const effectiveOffset = sideConfig.offset;
      const effectiveWidthMm = sideConfig.widthMm;

      const cutW =
        effectiveWidthMm !== null
          ? Math.min(effectiveWidthMm, side.wallSpan)
          : side.wallSpan * (effectiveWidth / 100);
      if (cutW <= 0 || effectiveDepth <= 0) continue;
      const userCutH = wallHeight * (effectiveDepth / 100);
      if (cutW < 0.1 || userCutH < 0.1) continue;

      const centerOffset = computeCutoutCenter(
        side.wallSpan,
        cutW,
        wallThickness,
        effectiveAlignment,
        effectiveOffset
      );

      // Ghost Z is in final mesh coordinates (translated up by SOCKET_HEIGHT).
      // Only show the user-visible portion (bottom of U-notch), not the overshoot.
      const topZ = totalH;
      const cutCenterZ = topZ - userCutH / 2;

      // Same clamps the profile applies, so the outline cannot promise a blend
      // the solid will decline to build.
      const corner = safeCutoutCornerRadii(
        resolveCutoutCornerRadii(walls, sideConfig, cutW),
        cutW,
        userCutH,
        base.stackingLip ? GRIDFINITY_SPEC.LIP_HEIGHT : 0,
        cornerSlackFor(side.wallSpan, cutW, centerOffset)
      );

      addOutline(
        side.cx + centerOffset,
        side.cy,
        cutCenterZ,
        cutW / 2,
        userCutH / 2,
        side.axis,
        corner
      );
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
    // `base.stackingLip` and not `base`: the lip is the only field the outline
    // reads directly, and `wallHeight` already covers the rest. Toggling it
    // changes no other dependency, so leaving it out strands the outline on
    // the previous clamp.
  }, [shouldShow, walls, innerW, innerD, wallHeight, wallThickness, totalH, base.stackingLip]);

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
