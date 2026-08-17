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
import { baseFloorZ, baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useDesignerStore, useCutoutSelection } from '@/features/bin-designer/store';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { expandInteriorForOverhang } from '@/features/bin-designer/utils/binDimensions';
import type { Cutout } from '@/features/bin-designer/types';
import { buildCutoutGeometry } from './ghostCutoutGeometry';

/** Ghost line color (amber — matches other ghost previews) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.6;
const LINE_WIDTH = 2;
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
    lid,
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
      lid: s.params.lid,
      overhang: s.params.overhang,
      cellMask: s.params.cellMask,
      generationStatus: s.generation.status,
    }))
  );

  const selectedIds = useCutoutSelection((s) => s.selectedIds);
  const previewOverrides = useCutoutSelection((s) => s.previewOverrides);

  const isSolid = base.solid;
  const totalH = height * heightUnitMm;
  const wallHeight = baseWallHeight(base, totalH);
  const floorZ = baseFloorZ(base, heightUnitMm, lid);

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  // Overhang grows the interior floor outward and, when asymmetric, shifts it
  // within the body — match the generator so the ghost sits where the final
  // cut lands.
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
    return buildCutoutGeometry(cutoutsToRender, originX, originY, floorZ + wallHeight);
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
