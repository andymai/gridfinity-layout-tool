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

import { useMemo } from 'react';
import { baseFloorZ, baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore, useCutoutSelection } from '@/features/bin-designer/store';
import { useGhostLineSegments } from '../useGhostLineSegments';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { expandInteriorForOverhang } from '@/features/bin-designer/utils/binDimensions';
import type { Cutout } from '@/features/bin-designer/types';
import { buildCutoutGeometry } from './ghostCutoutGeometry';

/** Ghost line color (amber — matches other ghost previews) */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.6;
const LINE_WIDTH = 2;
export function GhostCutouts() {
  const {
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    wallThickness,
    cutouts,
    cutoutConfig,
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
      cutoutConfig: s.params.cutoutConfig,
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
  const floorZ = baseFloorZ(base, heightUnitMm, lid, cellMask);
  // The worker cuts from the solid FILL surface, which the global top offset
  // lowers below the rim — and skips every cutout when nothing of it remains.
  const fillSurface = wallHeight - cutoutConfig.topOffset;

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
    if (!isSolid || cutouts.length === 0 || fillSurface <= 0) return [];
    // Hidden cutouts are dropped for the reason the builder drops them
    // (#3568): a ghost for a shape the export will not cut is the exact
    // preview-vs-export divergence the hidden flag's epoch bump exists to
    // prevent. `OffBoardFrames3D` applies the same filter.
    const visible = cutouts.filter((c) => c.hidden !== true);
    let result: readonly Cutout[];
    if (isGenerating) {
      result = visible;
    } else if (hasSelection) {
      result = visible.filter((c) => selectedIds.has(c.id));
    } else {
      return [];
    }
    return result.map((c) => {
      const overrides = previewOverrides.get(c.id);
      const merged = overrides ? { ...c, ...overrides } : c;
      // The worker cuts at most the remaining fill (`effectiveDepth`), so a
      // deeper stored cutDepth must not draw a floor below the bin's own.
      return merged.cutDepth > fillSurface ? { ...merged, cutDepth: fillSurface } : merged;
    });
  }, [isSolid, cutouts, isGenerating, hasSelection, selectedIds, previewOverrides, fillSurface]);

  const shouldShow = cutoutsToRender.length > 0;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;
    return buildCutoutGeometry(cutoutsToRender, originX, originY, floorZ + fillSurface);
  }, [shouldShow, cutoutsToRender, floorZ, fillSurface, originX, originY]);

  // Drawn through the walls so the cutout depth reads from any angle.
  const lineSegments = useGhostLineSegments(geometry, {
    color: GHOST_COLOR,
    opacity: GHOST_OPACITY,
    lineWidth: LINE_WIDTH,
    throughSolid: true,
  });

  if (!lineSegments) return null;

  return <primitive object={lineSegments} position={[0, 0, 0.1]} renderOrder={3} />;
}
