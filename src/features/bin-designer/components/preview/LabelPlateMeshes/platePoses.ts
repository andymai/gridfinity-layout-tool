/**
 * Pose math for the label-plate preview — where each plate sits when seated in
 * its socket, and where it sits in the reference row beside the bin.
 *
 * Pure and separate from the component so the placement rules are testable
 * without a WebGL canvas.
 */

import type { LabelPlateMeshData } from '@/shared/types/generation';

/** Matches `GhostDividerPieces` so reference parts share one parking spot. */
export const REFERENCE_GAP = 20;

/** Gap between plates in the reference row (mm). */
export const ROW_GAP = 4;

/**
 * How far a plate withdraws from its socket at full explode (mm). Enough to
 * clear the pocket and read the socket profile beneath it.
 */
export const MAX_SLIDE_MM = 18;

export type Pose = readonly [number, number, number];

/**
 * Where a plate sits given the shared explode offset.
 *
 * Withdrawal runs along the plate's own socket axis, so back- and
 * front-anchored shelves open in opposite directions rather than all sliding
 * the same way.
 */
export function seatedPose(plate: LabelPlateMeshData, explodeMm: number): Pose {
  const slide = Math.min(Math.max(explodeMm, 0), MAX_SLIDE_MM);
  return [plate.seatX, plate.seatY + plate.slideY * slide, plate.seatZ];
}

/**
 * Lay the reference row out along X, centred on the bin and parked beyond its
 * back face. Static by design — the row is an exhibit of what gets printed,
 * not part of the assembly, so it does not move with the explode slider.
 */
export function referenceRowPoses(
  plates: readonly LabelPlateMeshData[],
  outerDepthMm: number
): Pose[] {
  const y = outerDepthMm / 2 + REFERENCE_GAP;
  const totalW =
    plates.reduce((sum, p) => sum + p.widthMm, 0) + Math.max(0, plates.length - 1) * ROW_GAP;

  const poses: Pose[] = [];
  let offset = 0;
  for (const plate of plates) {
    poses.push([-totalW / 2 + offset + plate.widthMm / 2, y, 0]);
    offset += plate.widthMm + ROW_GAP;
  }
  return poses;
}
