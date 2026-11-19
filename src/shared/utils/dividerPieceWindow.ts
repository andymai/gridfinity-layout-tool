import type { WallConfig } from '@/shared/types/bin';
import {
  computeCutoutCenter,
  cornerSlackFor,
  resolveCutoutCornerRadii,
  resolveCutoutDrop,
  resolveCutoutSpan,
  safeCutoutCornerRadii,
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

/** Solid kept between a window and a cross-lap notch, so a piece stays one part. */
export const WINDOW_NOTCH_BRIDGE_MM = 2;

/**
 * Half the opening at the top edge. The shoulder round-over widens it by up to
 * its radius, clamped the way the cutter's profile clamps it.
 */
export function windowReach(window: PieceWindow): number {
  const safe = safeCutoutCornerRadii(
    window.radii,
    window.width,
    window.depth,
    0,
    window.cornerSlack
  );
  return window.width / 2 + Math.max(safe.topLeft, safe.topRight);
}

/**
 * Hold a window clear of the cross-lap notches it spans. A notch from the
 * bottom edge and a window from the top would meet and cut the piece in two,
 * so the window stops `WINDOW_NOTCH_BRIDGE_MM` above the notch's reach. Both
 * pieces of a crossing take the same cap, so their windows meet at one height.
 * Null when no window is left.
 */
export function clearOfNotches(
  window: PieceWindow,
  notches: readonly { readonly offset: number; readonly width: number }[],
  height: number,
  notchDepth: number
): PieceWindow | null {
  const reach = windowReach(window);
  const spans = notches.some((n) => Math.abs(n.offset - window.offset) < reach + n.width / 2);
  if (!spans) return window;
  const depth = Math.min(window.depth, height - notchDepth - WINDOW_NOTCH_BRIDGE_MM);
  return depth >= 0.1 ? { ...window, depth } : null;
}
