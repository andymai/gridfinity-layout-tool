/**
 * Renders ghost cutout outlines in the 3D preview.
 *
 * Shows translucent shape outlines at the top surface and at the cut depth
 * of cutouts, providing instant visual feedback for placement and depth.
 *
 * - Selected cutouts: always visible (amber, x-ray through walls)
 * - During generation: all cutouts visible as ghost outlines
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
import { useDesignerStore, useCutoutSelection } from '@/features/bin-designer/store';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { expandInteriorForOverhang } from '@/features/bin-designer/utils/binDimensions';
import type { Cutout } from '@/features/bin-designer/types';
import {
  flattenPath,
  MIN_PATH_POINTS,
} from '@/features/bin-designer/components/panel/CutoutsSection/pathGeometry';

/** Ghost line color (amber — matches other ghost previews) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.6;
const LINE_WIDTH = 2;
/** Number of segments for circle approximation */
const CIRCLE_SEGMENTS = 24;

function buildCutoutGeometry(
  cutoutsToRender: readonly Cutout[],
  originX: number,
  originY: number,
  floorZ: number,
  wallHeight: number
): LineSegmentsGeometry | null {
  const positions: number[] = [];

  for (const cutout of cutoutsToRender) {
    const cx = originX + cutout.x + cutout.width / 2;
    const cy = originY + cutout.y + cutout.depth / 2;
    const topZ = floorZ + wallHeight;
    const bottomZ = floorZ + wallHeight - cutout.cutDepth;

    if (cutout.shape === 'circle') {
      const rx = cutout.width / 2;
      const ry = cutout.depth / 2;
      const rad = (-cutout.rotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      for (let z = 0; z < 2; z++) {
        const zVal = z === 0 ? topZ : bottomZ;
        for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
          const a1 = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
          const a2 = ((i + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
          // Parametric ellipse points, then rotate
          const ex1 = Math.cos(a1) * rx;
          const ey1 = Math.sin(a1) * ry;
          const ex2 = Math.cos(a2) * rx;
          const ey2 = Math.sin(a2) * ry;
          positions.push(
            cx + ex1 * cosR - ey1 * sinR,
            cy + ex1 * sinR + ey1 * cosR,
            zVal,
            cx + ex2 * cosR - ey2 * sinR,
            cy + ex2 * sinR + ey2 * cosR,
            zVal
          );
        }
      }
      // Vertical lines connecting top and bottom ellipses (4 cardinal points)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const px = cx + ex * cosR - ey * sinR;
        const py = cy + ex * sinR + ey * cosR;
        positions.push(px, py, topZ, px, py, bottomZ);
      }
    } else if (cutout.shape === 'path' && cutout.path && cutout.path.length >= MIN_PATH_POINTS) {
      // Flatten bezier path to polyline and render actual shape outline
      const flat = flattenPath(cutout.path);
      const n = flat.length;
      if (n >= 3) {
        // Path points are in bin-local absolute coords — offset by origin
        for (let z = 0; z < 2; z++) {
          const zVal = z === 0 ? topZ : bottomZ;
          for (let i = 0; i < n; i++) {
            const p1 = flat[i];
            const p2 = flat[(i + 1) % n];
            positions.push(
              originX + p1.x,
              originY + p1.y,
              zVal,
              originX + p2.x,
              originY + p2.y,
              zVal
            );
          }
        }
        // Vertical lines at every few vertices to show depth
        const vertStep = Math.max(1, Math.floor(n / 8));
        for (let i = 0; i < n; i += vertStep) {
          const p = flat[i];
          positions.push(originX + p.x, originY + p.y, topZ, originX + p.x, originY + p.y, bottomZ);
        }
      }
    } else {
      const hw = cutout.width / 2;
      const hd = cutout.depth / 2;
      // Unrotated corners relative to center
      const rawCorners: [number, number][] = [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ];
      // Apply rotation around center
      const rad = (-cutout.rotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      const corners = rawCorners.map(([rx, ry]) => [
        cx + rx * cosR - ry * sinR,
        cy + rx * sinR + ry * cosR,
      ]);

      for (let z = 0; z < 2; z++) {
        const zVal = z === 0 ? topZ : bottomZ;
        for (let i = 0; i < 4; i++) {
          const [x1, y1] = corners[i];
          const [x2, y2] = corners[(i + 1) % 4];
          positions.push(x1, y1, zVal, x2, y2, zVal);
        }
      }
      for (const [px, py] of corners) {
        positions.push(px, py, topZ, px, py, bottomZ);
      }
    }
  }

  if (positions.length === 0) return null;

  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  return geo;
}

export function GhostCutouts() {
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
    cutouts,
    base,
    overhang,
    cellMask,
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
      cutouts: s.params.cutouts,
      base: s.params.base,
      overhang: s.params.overhang,
      cellMask: s.params.cellMask,
      generationStatus: s.generation.status,
    }))
  );

  const selectedIds = useCutoutSelection((s) => s.selectedIds);
  const previewOverrides = useCutoutSelection((s) => s.previewOverrides);

  const isSolid = base.solid;
  const totalH = height * heightUnitMm;
  const isFlat = base.style === 'flat';
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.BASE_HEIGHT;
  const floorZ = isFlat ? 0 : GRIDFINITY.BASE_HEIGHT;

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  // Overhang grows the interior floor outward and, when asymmetric, shifts it
  // within the body — match the generator so the ghost sits where the final
  // cut lands (#2462).
  const { innerW, innerD, offsetX, offsetY } = expandInteriorForOverhang(
    outerW - 2 * wallThickness,
    outerD - 2 * wallThickness,
    overhang,
    cellMask
  );
  const originX = -innerW / 2 + offsetX;
  const originY = -innerD / 2 + offsetY;

  const hasSelection = selectedIds.size > 0;
  const isGenerating = generationStatus === 'generating';

  // Determine which cutouts to render:
  // - Selected cutouts: always shown (when solid + has cutouts)
  // - All cutouts: shown during generation
  // Apply live preview overrides (drag/resize/rotate) for real-time 3D feedback
  const cutoutsToRender = useMemo(() => {
    if (!isSolid || cutouts.length === 0) return [];
    let result: readonly Cutout[];
    if (isGenerating) {
      result = cutouts;
    } else if (hasSelection) {
      result = cutouts.filter((c) => selectedIds.has(c.id));
    } else {
      return [];
    }
    if (previewOverrides.size === 0) return result;
    return result.map((c) => {
      const overrides = previewOverrides.get(c.id);
      return overrides ? { ...c, ...overrides } : c;
    });
  }, [isSolid, cutouts, isGenerating, hasSelection, selectedIds, previewOverrides]);

  const shouldShow = cutoutsToRender.length > 0;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;
    return buildCutoutGeometry(cutoutsToRender, originX, originY, floorZ, wallHeight);
  }, [shouldShow, cutoutsToRender, floorZ, wallHeight, originX, originY]);

  const material = useMemo(() => {
    if (!shouldShow) return null;

    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      // Disable depth test so ghost lines render on top of bin walls,
      // making cutout depth clearly visible from any angle.
      depthTest: false,
      depthWrite: false,
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

  return <primitive ref={lineRef} object={lineSegments} position={[0, 0, 0.1]} renderOrder={3} />;
}
