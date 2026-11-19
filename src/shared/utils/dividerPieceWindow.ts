import type { WallConfig } from '@/shared/types/bin';
import {
  computeCutoutCenter,
  cornerSlackFor,
  resolveCutoutCornerRadii,
  resolveCutoutDrop,
  resolveCutoutSpan,
  type CornerSlack,
  type CutoutCornerRadii,
} from './wallCutoutPosition';

/** The interior wall cutout on one removable divider piece, in its flat frame. */
export interface PieceWindow {
  /** Centre of the window along the piece, from the piece's centre. */
  readonly offset: number;
  readonly width: number;
  /** How far the window reaches down from the piece's top edge. */
  readonly depth: number;
  readonly cornerSlack: CornerSlack;
  readonly radii: CutoutCornerRadii;
}

/**
 * The "Interior walls" cutout that a removable piece takes, by the rules a
 * fixed divider follows (`computeInteriorDividerCutouts`).
 *
 * `span` is the part of the piece that stands in the cavity, between the faces
 * it seats against, and `spanCentre` is its centre measured from the piece's
 * centre. `standing` is the piece's height above the bin floor, which a
 * percentage depth is measured against: the part in a floor groove is hidden.
 */
export function planPieceWindow(
  walls: WallConfig,
  wallThickness: number,
  span: number,
  spanCentre: number,
  standing: number
): PieceWindow | null {
  const cfg = walls.interior;
  if (!walls.enabled || !cfg.enabled) return null;
  const width = resolveCutoutSpan(cfg, span);
  const depth = resolveCutoutDrop(cfg, standing);
  if (width < 0.1 || depth < 0.1) return null;
  const centre = computeCutoutCenter(span, width, wallThickness, cfg.alignment, cfg.offset);
  return {
    offset: spanCentre + centre,
    width,
    depth,
    cornerSlack: cornerSlackFor(span, width, centre),
    radii: resolveCutoutCornerRadii(walls, cfg, width),
  };
}
