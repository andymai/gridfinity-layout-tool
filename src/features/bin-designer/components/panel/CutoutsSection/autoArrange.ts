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
import { unitTag, unitTagShapeId } from '@/features/bin-designer/utils/cutoutHierarchy';
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
  readonly rotation?: number;
}

/** A turned outline is measured through sines, so its placement carries float noise. */
const tidy = (mm: number): number => Math.round(mm * 1e6) / 1e6;

interface Packed {
  readonly unit: ArrangeUnit;
  readonly bounds: Bounds;
  readonly rotation?: number;
}

/** The editor keeps angles in [0°, 360°); its rotation field clamps anything else. */
const storedAngle = (deg: number): number => ((deg % 360) + 360) % 360;

function packed(
  unit: ArrangeUnit,
  turn: boolean,
  context: readonly string[],
  room: { readonly w: number; readonly d: number }
): Packed {
  const [only] = unit.members;
  // A group is one block at this level even when it holds a single shape.
  const tag = unit.members.length === 1 ? unitTag(only, context) : null;
  if (!turn || tag === null || unitTagShapeId(tag) === null) return { unit, bounds: unit.bounds };
  const best = minAreaTurn(only);
  if (best === null) return { unit, bounds: unit.bounds };
  // Landscape fills rows best, but a shape too long for the bin's width lies
  // along its depth instead, and one that fits the bin neither way keeps its
  // angle.
  for (const rotation of [best, best + 90]) {
    // Measured the way the board measures it, so the packed shape never reads
    // as off it, and arranging again finds the same room.
    const bounds = getCutoutBounds({ ...only, rotation });
    if (bounds.maxX - bounds.minX > room.w + 1e-6 || bounds.maxY - bounds.minY > room.d + 1e-6) {
      continue;
    }
    // Half a turn from the current angle is the same size of box, so the angle
    // stays; a path turns about its own centre, so the box is measured again
    // where the kept angle puts it.
    const gap180 = Math.abs(storedAngle(rotation - only.rotation) % 180);
    if (Math.min(gap180, 180 - gap180) < 1e-3) return { unit, bounds: getCutoutBounds(only) };
    return { unit, bounds, rotation: storedAngle(rotation) };
  }
  return { unit, bounds: unit.bounds };
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
  const { binWidth, binDepth, gap, staggered = false, turn = false } = options;
  // Quantized, so the sines a turned outline is measured through cannot tip
  // two equal shapes into a different order or row when arranged again.
  const width = (p: Packed) => tidy(p.bounds.maxX - p.bounds.minX);
  const depth = (p: Packed) => tidy(p.bounds.maxY - p.bounds.minY);
  const movable = toArrangeUnits(cutouts, context)
    .filter((unit) => !unit.locked)
    .map((unit) => packed(unit, turn, context, { w: binWidth - 2 * gap, d: binDepth - 2 * gap }));
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
