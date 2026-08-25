/**
 * Alignment guides + multi-cutout layout helpers.
 *
 * `findAlignmentGuides` powers the dotted snap-line overlay during
 * drag/resize. `distribute*` and `centerInBin` are the discrete
 * "align/distribute" toolbar actions — each returns a positions-only
 * patch map so callers can apply via `updateCutoutsBatch`.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { type Bounds, getEffectiveBounds } from './geometryCore';
import { toArrangeUnits, unitsBounds, unitWidth, unitDepth } from './cutoutGroups';

/** Distribute needs a fixed unit at each end plus something to place between them. */
const MIN_DISTRIBUTE_UNITS = 3;

/** A guide line indicating alignment between cutouts */
export interface AlignmentGuide {
  /** Whether this is a horizontal (Y-axis) or vertical (X-axis) guide */
  readonly axis: 'x' | 'y';
  /** Position of the guide line in mm */
  readonly position: number;
}

/** Snap threshold in mm — within this range, cutout snaps to guide */
export const GUIDE_SNAP_THRESHOLD = 1;

/**
 * Find alignment guides between the moving cutouts and stationary cutouts.
 * Checks edges (min/max) and centers of each axis.
 */
export function findAlignmentGuides(
  movingBounds: Bounds,
  stationaryCutouts: readonly Cutout[],
  threshold: number = GUIDE_SNAP_THRESHOLD
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];

  // Key positions of the moving cutout(s)
  const movingCenterX = (movingBounds.minX + movingBounds.maxX) / 2;
  const movingCenterY = (movingBounds.minY + movingBounds.maxY) / 2;
  const movingXPositions = [movingBounds.minX, movingCenterX, movingBounds.maxX];
  const movingYPositions = [movingBounds.minY, movingCenterY, movingBounds.maxY];

  for (const cutout of stationaryCutouts) {
    const b = getEffectiveBounds(cutout);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const xPositions = [b.minX, cx, b.maxX];
    const yPositions = [b.minY, cy, b.maxY];

    // Check X alignment (vertical guide lines)
    for (const mx of movingXPositions) {
      for (const sx of xPositions) {
        if (Math.abs(mx - sx) < threshold) {
          guides.push({ axis: 'x', position: sx });
        }
      }
    }

    // Check Y alignment (horizontal guide lines)
    for (const my of movingYPositions) {
      for (const sy of yPositions) {
        if (Math.abs(my - sy) < threshold) {
          guides.push({ axis: 'y', position: sy });
        }
      }
    }
  }

  // Deduplicate guides at same position
  const seen = new Set<string>();
  return guides.filter((g) => {
    const key = `${g.axis}:${g.position.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Distribute units evenly along the horizontal axis.
 * Spaces them so there's equal gap between each.
 *
 * A locked unit keeps its position — it still contributes to the span, so the
 * gap it sits in simply comes out uneven rather than the lock being ignored.
 */
export function distributeHorizontally(
  cutouts: readonly Cutout[],
  _binWidth: number,
  context: readonly string[] = []
): Record<string, { x: number }> {
  const units = toArrangeUnits(cutouts, context);
  if (units.length < MIN_DISTRIBUTE_UNITS) return {};

  const sorted = [...units].sort((a, b) => a.bounds.minX - b.bounds.minX);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Total space between leftmost left edge and rightmost right edge
  const totalSpan = last.bounds.maxX - first.bounds.minX;
  const totalWidths = sorted.reduce((sum, u) => sum + unitWidth(u), 0);
  const gap = (totalSpan - totalWidths) / (sorted.length - 1);

  const result: Record<string, { x: number }> = {};
  let currentX = first.bounds.minX;
  for (const unit of sorted) {
    if (!unit.locked) {
      const dx = currentX - unit.bounds.minX;
      for (const member of unit.members) result[member.id] = { x: member.x + dx };
    }
    currentX += unitWidth(unit) + gap;
  }
  return result;
}

/**
 * Distribute units evenly along the vertical axis.
 */
export function distributeVertically(
  cutouts: readonly Cutout[],
  _binDepth: number,
  context: readonly string[] = []
): Record<string, { y: number }> {
  const units = toArrangeUnits(cutouts, context);
  if (units.length < MIN_DISTRIBUTE_UNITS) return {};

  const sorted = [...units].sort((a, b) => a.bounds.minY - b.bounds.minY);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = last.bounds.maxY - first.bounds.minY;
  const totalDepths = sorted.reduce((sum, u) => sum + unitDepth(u), 0);
  const gap = (totalSpan - totalDepths) / (sorted.length - 1);

  const result: Record<string, { y: number }> = {};
  let currentY = first.bounds.minY;
  for (const unit of sorted) {
    if (!unit.locked) {
      const dy = currentY - unit.bounds.minY;
      for (const member of unit.members) result[member.id] = { y: member.y + dy };
    }
    currentY += unitDepth(unit) + gap;
  }
  return result;
}

/**
 * Which axes a centering action moves. The single-axis modes exist because
 * centering both at once throws away a position the user placed deliberately:
 * a shape centred left-to-right often still belongs near the front or back.
 */
export type CenterAxis = 'both' | 'x' | 'y';

/**
 * The three centering entries in menu order, shared by the workspace and panel
 * context menus so the two cannot drift apart.
 */
export const CENTER_ACTIONS: ReadonlyArray<{ readonly axis: CenterAxis; readonly key: string }> = [
  { axis: 'both', key: 'binDesigner.cutouts.centerInBin' },
  { axis: 'x', key: 'binDesigner.cutouts.centerH' },
  { axis: 'y', key: 'binDesigner.cutouts.centerV' },
];

/**
 * Center a selection within the bin.
 *
 * One delta for the whole selection, so relative offsets are preserved; a
 * locked unit stays behind rather than riding along. The untouched axis is
 * still returned at its current value, so a caller can apply the result
 * without knowing which axis moved.
 */
export function centerInBin(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number,
  axis: CenterAxis = 'both',
  context: readonly string[] = []
): Record<string, { x: number; y: number }> {
  if (cutouts.length === 0) return {};

  const units = toArrangeUnits(cutouts, context);
  const bounds = unitsBounds(units);
  const groupW = bounds.maxX - bounds.minX;
  const groupH = bounds.maxY - bounds.minY;
  const dx = axis === 'y' ? 0 : (binWidth - groupW) / 2 - bounds.minX;
  const dy = axis === 'x' ? 0 : (binDepth - groupH) / 2 - bounds.minY;

  const result: Record<string, { x: number; y: number }> = {};
  for (const unit of units) {
    if (unit.locked) continue;
    for (const member of unit.members) {
      result[member.id] = { x: member.x + dx, y: member.y + dy };
    }
  }
  return result;
}
