/**
 * Where a lid's grip relief sits on each wall, kernel-free.
 *
 * Kept apart from `lidGripRelief`, which cuts it, so the rail split and the
 * designer panel can read the same spans without pulling in the kernel.
 */

import { maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import { resolveLidGripSpanMm, LID_GRIP_MIN_USEFUL_DEPTH_MM } from '@/shared/types/bin';
import type { LidRailSide } from '@/shared/types/bin';
import type { LidInputs } from './lidInputs';

/** A relief on one wall: where its span is centered and how it is oriented. */
export interface GripPlacement {
  readonly side: LidRailSide;
  /** Midpoint of the wall's outer face, in lid-local XY. */
  readonly centerX: number;
  readonly centerY: number;
  /** Length of the relief along the wall. */
  readonly spanMm: number;
  /** Z rotation mapping the canonical (back-wall) cutter onto this wall. */
  readonly rotationDeg: number;
}

/**
 * Outward direction → side name and the Z rotation that maps a canonical
 * back-wall shape onto it.
 *
 * Shared by both grip paths and the rail polygon path: a rail and a relief on
 * the same edge are matched by orientation in `splitRailsAroundGrip`, so two
 * copies of this mapping that drifted would split the wrong wall. Returns
 * `null` for a non-axis-aligned edge, which a cellMask polygon should never
 * produce.
 */
export function sideForOutward(
  outX: number,
  outY: number
): { side: LidRailSide; rotationDeg: number } | null {
  if (outX === 0 && outY === 1) return { side: 'back', rotationDeg: 0 };
  if (outX === 0 && outY === -1) return { side: 'front', rotationDeg: 180 };
  if (outX === 1 && outY === 0) return { side: 'right', rotationDeg: -90 };
  if (outX === -1 && outY === 0) return { side: 'left', rotationDeg: 90 };
  return null;
}

/**
 * Straight run available on a wall — its length less the corner radius at each
 * end, matching the span a click rail is allowed. A relief that ran into a
 * corner would cut the mating shell's solid corner pillar.
 */
function usableRun(edgeLenMm: number, lidCornerR: number): number {
  return edgeLenMm - 2 * lidCornerR;
}

function gripPlacementsForRectangle(inputs: LidInputs): GripPlacement[] {
  const { lidOuterW, lidOuterD, lidCornerR, grip, outerOffsetX: offX, outerOffsetY: offY } = inputs;
  const runX = usableRun(lidOuterW, lidCornerR);
  const runY = usableRun(lidOuterD, lidCornerR);
  const halfW = lidOuterW / 2;
  const halfD = lidOuterD / 2;

  const placements: GripPlacement[] = [];

  if (runX > 0) {
    const spanMm = resolveLidGripSpanMm(runX, grip.coverage);
    if (grip.sides.back) {
      placements.push({
        side: 'back',
        centerX: offX,
        centerY: halfD + offY,
        spanMm,
        rotationDeg: 0,
      });
    }
    if (grip.sides.front) {
      placements.push({
        side: 'front',
        centerX: offX,
        centerY: -halfD + offY,
        spanMm,
        rotationDeg: 180,
      });
    }
  }

  if (runY > 0) {
    const spanMm = resolveLidGripSpanMm(runY, grip.coverage);
    if (grip.sides.right) {
      placements.push({
        side: 'right',
        centerX: halfW + offX,
        centerY: offY,
        spanMm,
        rotationDeg: -90,
      });
    }
    if (grip.sides.left) {
      placements.push({
        side: 'left',
        centerX: -halfW + offX,
        centerY: offY,
        spanMm,
        rotationDeg: 90,
      });
    }
  }

  return placements;
}

function gripPlacementsForPolygon(inputs: LidInputs): GripPlacement[] {
  const { cellMask, gridUnitMm, gridUnitMmY, lidCornerR, fitClearance, grip } = inputs;
  if (!cellMask) return [];

  const outer = maskToPolygon(cellMask)[0];
  const halfWidthMm = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (cellMask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;
  const verticesMm = outer.map((p) => ({
    x: p.x * gridUnitMm - halfWidthMm,
    y: p.y * gridUnitMmY - halfDepthMm,
  }));

  const placements: GripPlacement[] = [];
  for (let i = 0; i < verticesMm.length; i++) {
    const a = verticesMm[i];
    const b = verticesMm[(i + 1) % verticesMm.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.abs(dx) + Math.abs(dy);
    const run = usableRun(edgeLen, lidCornerR);
    if (run <= 0) continue;

    const outX = Math.sign(dy);
    const outY = -Math.sign(dx);
    const classified = sideForOutward(outX, outY);
    if (!classified || !grip.sides[classified.side]) continue;

    // The lid's perimeter sits `fitClearance` inboard of the mask polygon, so
    // the outer face this relief cuts is that far in from the raw edge.
    placements.push({
      side: classified.side,
      centerX: (a.x + b.x) / 2 - outX * fitClearance,
      centerY: (a.y + b.y) / 2 - outY * fitClearance,
      spanMm: resolveLidGripSpanMm(run, grip.coverage),
      rotationDeg: classified.rotationDeg,
    });
  }
  return placements;
}

/**
 * Where each enabled wall's relief sits. The cutter, the rail split and the
 * bin's lip dip all register against this one derivation.
 */
export function gripPlacements(inputs: LidInputs): readonly GripPlacement[] {
  if (inputs.grip.mode === 'none' || inputs.gripDepthMm < LID_GRIP_MIN_USEFUL_DEPTH_MM) return [];
  return inputs.cellMask ? gripPlacementsForPolygon(inputs) : gripPlacementsForRectangle(inputs);
}
