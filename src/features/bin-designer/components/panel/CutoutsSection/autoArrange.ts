/**
 * Auto-arrange algorithm for cutouts using shelf-based bin packing.
 *
 * Sorts units by depth descending, then places them left-to-right in rows,
 * starting a new row when the current one overflows.
 *
 * A unit is a whole cutout group or a single ungrouped cutout — packing raw
 * cutouts scattered the members of a group across the bin. Placement
 * is a translation of the unit's rotated silhouette, so a rotated shape claims
 * the space it actually occupies rather than its unrotated width and depth.
 * With `turn`, a lone shape is first turned to its smallest landscape box (see
 * {@link minAreaTurn}); a group or an arrange-only container moves as one
 * rigid block and keeps its turn.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { toArrangeUnits, type ArrangeUnit } from './cutoutGroups';
import type { Bounds } from './geometryCore';
import { getCutoutBounds } from './maskFit';
import { minAreaTurn } from './minAreaTurn';

export interface AutoArrangeOptions {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly gap: number;
  readonly staggered?: boolean;
  /** Turn each lone shape to its smallest box before packing. */
  readonly turn?: boolean;
}

export interface ArrangedPlacement {
  readonly x: number;
  readonly y: number;
  /** Present only when the shape is turned. */
  readonly rotation?: number;
}

/** A turned outline is measured through sines, so its placement carries float noise. */
const tidy = (mm: number): number => Math.round(mm * 1e6) / 1e6;

interface Packed {
  readonly unit: ArrangeUnit;
  readonly bounds: Bounds;
  readonly rotation?: number;
}

function packed(unit: ArrangeUnit, turn: boolean): Packed {
  const [only] = unit.members;
  if (!turn || unit.members.length !== 1) return { unit, bounds: unit.bounds };
  const rotation = minAreaTurn(only);
  if (rotation === null) return { unit, bounds: unit.bounds };
  // Measured the way the board measures it, so the packed shape never reads as
  // off it, and arranging again finds the same room.
  const bounds = getCutoutBounds({ ...only, rotation });
  return rotation === only.rotation ? { unit, bounds } : { unit, bounds, rotation };
}

/**
 * Compute new positions for cutouts using shelf-based bin packing.
 * When `staggered` is true, alternate rows are offset by half the average item width.
 * Returns a map of cutout ID → new position, and new rotation for a turned shape.
 *
 * Locked units keep their position and are packed around rather than moved —
 * their footprint is not reserved, so a locked unit can end up overlapped.
 */
export function autoArrangeCutouts(
  cutouts: readonly Cutout[],
  options: AutoArrangeOptions,
  context: readonly string[] = []
): Record<string, ArrangedPlacement> {
  const { binWidth, gap, staggered = false, turn = false } = options;
  const width = (p: Packed) => p.bounds.maxX - p.bounds.minX;
  const depth = (p: Packed) => p.bounds.maxY - p.bounds.minY;
  const movable = toArrangeUnits(cutouts, context)
    .filter((unit) => !unit.locked)
    .map((unit) => packed(unit, turn));
  const sorted = [...movable].sort((a, b) => depth(b) - depth(a));
  const positions: Record<string, ArrangedPlacement> = {};

  // Compute average width for stagger offset
  const avgWidth =
    staggered && sorted.length > 0
      ? sorted.reduce((sum, item) => sum + width(item), 0) / sorted.length
      : 0;

  let rowIndex = 0;
  const staggerOffset = staggered && rowIndex % 2 === 1 ? avgWidth / 2 : 0;
  let currentX = gap + staggerOffset;
  let currentY = gap;
  let rowHeight = 0;

  for (const item of sorted) {
    const w = width(item);
    const d = depth(item);

    // Start new row if unit doesn't fit
    if (currentX + w + gap > binWidth) {
      rowIndex++;
      const offset = staggered && rowIndex % 2 === 1 ? avgWidth / 2 : 0;
      currentX = gap + offset;
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    const dx = currentX - item.bounds.minX;
    const dy = currentY - item.bounds.minY;
    for (const member of item.unit.members) {
      positions[member.id] = {
        x: tidy(member.x + dx),
        y: tidy(member.y + dy),
        ...(item.rotation === undefined ? {} : { rotation: item.rotation }),
      };
    }

    currentX += w + gap;
    rowHeight = Math.max(rowHeight, d);
  }

  return positions;
}
