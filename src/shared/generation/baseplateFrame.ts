/**
 * Plate-frame derivations that the BREP build and the screw plan must read
 * identically: the corner radii the rounding cut uses, and which cells a
 * custom perimeter keeps.
 *
 * Kernel-free because the plate-level screw pad is decided on the main thread
 * from params alone, before any piece is built. A copy of either derivation
 * there would let the pad and the geometry disagree about where a screw sits.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { classifyRect, type RegionClass } from '@/shared/utils/drawerOutlineGeometry';
import { resolveCornerRadii } from './generatorConstants';
import type { CellInfo } from './cellDecomposition';

type FrameParams = Pick<
  ResolvedBaseplateParams,
  | 'width'
  | 'depth'
  | 'gridUnitMm'
  | 'gridUnitMmY'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingFront'
  | 'paddingBack'
  | 'cornerRadius'
  | 'cornerRadii'
  | 'outline'
>;

/** Padded printed footprint of the plate in mm. */
export function plateFootprintMm(params: FrameParams): { widthMm: number; depthMm: number } {
  return {
    widthMm: params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight,
    depthMm:
      params.depth * (params.gridUnitMmY ?? params.gridUnitMm) +
      params.paddingFront +
      params.paddingBack,
  };
}

/**
 * Corner radii the rounding cut applies. Half a grid unit plus padding lets the
 * arc enter the corner cell but never pass its centre; half the slab keeps it
 * from going degenerate.
 */
export function plateCornerRadii(params: FrameParams): {
  tl: number;
  tr: number;
  bl: number;
  br: number;
} {
  const { widthMm, depthMm } = plateFootprintMm(params);
  const minPadding = Math.min(
    Math.min(params.paddingLeft, params.paddingRight),
    Math.min(params.paddingFront, params.paddingBack)
  );
  const cellLimit = params.gridUnitMm / 2 + minPadding;
  const geomLimit = Math.min(widthMm, depthMm) / 2 - 0.1;
  return resolveCornerRadii(params, Math.min(cellLimit, geomLimit));
}

/**
 * Classify a cell against the plate's outline. Cell centres live in the grid
 * frame (grid centred on the origin, slab offset by padding asymmetry) and the
 * outline is plate-local mm, so the frame mapping is inverted here.
 */
export function baseplateCellClassifier(params: FrameParams): (cell: CellInfo) => RegionClass {
  const outline = params.outline;
  if (outline === undefined) return () => 'inside';
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const { widthMm, depthMm } = plateFootprintMm(params);
  const slabOffsetX = (params.paddingRight - params.paddingLeft) / 2;
  const slabOffsetY = (params.paddingBack - params.paddingFront) / 2;
  return (cell) => {
    const w = cell.widthUnits * params.gridUnitMm;
    const d = cell.depthUnits * gridUnitMmY;
    const x0 = cell.centerX - w / 2 + widthMm / 2 - slabOffsetX;
    const y0 = cell.centerY - d / 2 + depthMm / 2 - slabOffsetY;
    return classifyRect(outline, x0, y0, x0 + w, y0 + d);
  };
}
