/**
 * Where a lid's click rails have to step around compartment dividers.
 *
 * A divider wall is built from the cavity floor to the interior ceiling, whose
 * top sits `LIP_SMALL_TAPER` below the bin's wall top. A seated rail hangs
 * `LID_CLICK_RAIL_BAND_BELOW_WALL_TOP` (3.05mm) under that same wall top and
 * reaches inboard past the inner wall face, so every point where a divider
 * terminates on a perimeter wall is solid-on-solid overlap — measured at 3.1mm
 * on a stock 3x2 grid, which is a lid that cannot close at all.
 *
 * Pure and kernel-free for the same reason `labelTabPlan` is: three layers have
 * to agree on the answer — the worker that places the rails, the panel readout
 * that counts them, and the compatibility warning that explains them — and the
 * latter two run on the main thread, which cannot import brepjs.
 */

import type { BinParams, DividerOverride, LidCompatibilitySide } from '@/shared/types/bin';
// Imported from their own modules rather than the `@/shared/types/bin` barrel,
// which re-exports `lidCompatibility` — the one consumer that has to import
// this file. Type-only imports above are erased and carry no such edge.
import {
  buildOverrideLookup,
  dividerFootDrift,
  findPairAwareRuns,
  overrideKey,
} from '@/features/bin-designer/utils/compartments';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { clickRailZBandAboveFloor, labelTabInteriorDims } from '@/shared/utils/labelTabPlan';
import type { WallSpanBlock } from '@/shared/utils/labelTabPlan';
import { railInboardReachMm } from '@/shared/constants/lidKeepout';
import { interiorReliefActive } from '@/shared/utils/lidInteriorRelief';

/**
 * Air (mm) kept between a rail's cut end and a divider's face.
 *
 * Deliberately below `labelTabPlan`'s 2mm: a divider is a thin wall crossing
 * the run rather than a shelf occupying it, so the margin is paid twice per
 * divider and a grid can carry seven of them on one wall. The lid is located by
 * the lip to within `LID_FIT_CLEARANCE` (0.25mm), so 1mm is four times the slop
 * the parts can actually have.
 */
export const DIVIDER_RAIL_MARGIN = 1;

/**
 * One stretch of one wall a divider takes out of the rail run.
 *
 * Structurally a {@link WallSpanBlock} — a divider is one of the four things
 * that can deny a rail a stretch of wall, and `railSegmentsClearOfBlocks`
 * applies them all with one pass.
 */
export type DividerRailBlock = WallSpanBlock;

/**
 * Half the footprint a divider of `thickness` leaves on the wall it crosses.
 *
 * A strip crossing a line at angle θ to it leaves an intercept of
 * `thickness / sin θ`, and for a run of `segLen` that drifts `drift` sideways
 * (a `dividerOverride` tilt) `sin θ` is `segLen / hypot(segLen, drift)`. A 45°
 * tilt is 1.41x thickness — inside the margin — but a steeper one is not.
 */
function crossingHalfSpan(thickness: number, segLen: number, drift: number): number {
  if (segLen <= 0) return thickness / 2;
  return (thickness * Math.hypot(segLen, drift)) / segLen / 2;
}

/**
 * Every stretch of wall a compartment divider denies to a click rail.
 *
 * Geometry only — it says nothing about whether this lid HAS rails. The
 * attachment gate lives at the call sites, matching `railFoulingLabelFootprints`.
 *
 * Returns nothing when the bin builds no divider walls at all: a polygon mask
 * (compartments are gated off), a solid or slotted style, a single compartment,
 * or cells too small for `buildCompartmentWallsInScope`'s viability guard. A
 * block that no divider backs would cost a rail for nothing.
 */
export function dividerRailBlocks(params: BinParams): readonly DividerRailBlock[] {
  const { cols, rows, cells, thickness } = params.compartments;
  // Nothing to notch: the interior relief has already taken this ring out of
  // the cavity, so the dividers stop short of the rails by construction and
  // the rails run unbroken.
  if (interiorReliefActive(params)) return [];
  if (isPartialMask(params.cellMask)) return [];
  if (params.style !== 'standard') return [];
  if (cols < 1 || rows < 1 || cells.length !== cols * rows) return [];
  if (new Set(cells).size <= 1) return [];

  const dims = labelTabInteriorDims(params);
  if (!dims) return [];
  const { innerW, innerD, interiorHeight, collarHeight } = dims;

  // Same heuristic `buildCompartmentWallsInScope` and `compartmentCavitiesAreViable`
  // bail on, so a grid too fine to produce walls produces no blocks either.
  if ((innerW - (cols - 1) * thickness) / cols < thickness * 2) return [];
  if ((innerD - (rows - 1) * thickness) / rows < thickness * 2) return [];

  // A divider stands on the floor, so only its top can reach the band. An
  // explicit `dividerHeight` that ends below the rail fouls nothing, and a tall
  // `extraWallHeightMm` collar lifts the band clear without moving the divider.
  const dividerTopZ = resolveCompartmentDividerHeight(
    params.compartments.dividerHeight,
    interiorHeight
  );
  const railBandLo = clickRailZBandAboveFloor(interiorHeight, collarHeight).lo;
  if (dividerTopZ <= railBandLo) return [];

  // Inboard-most reach of a rail on each axis, in the interior frame. Shared
  // with the keep-out ring so the two cannot disagree about where a rail ends.
  const reach = railInboardReachMm(params.wallThickness);
  const railInnerX = innerW / 2 - reach;
  const railInnerY = innerD / 2 - reach;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  const half = thickness / 2;
  const out: DividerRailBlock[] = [];

  const blockSpan = (side: LidCompatibilitySide, lo: number, hi: number): void => {
    out.push({ side, lo: lo - DIVIDER_RAIL_MARGIN, hi: hi + DIVIDER_RAIL_MARGIN });
  };
  // A rail is a bar occupying a BAND below the wall top, not a line at the rim,
  // so a leaning divider sweeps sideways across it. The notch has to cover the
  // whole swept footprint: at 45 degrees that is 2.45mm on a stock bin, well
  // past DIVIDER_RAIL_MARGIN, and a notch cut for the top edge alone leaves the
  // rail driving into solid divider a couple of millimetres down.
  const leanSweep = (ov: DividerOverride | undefined): number =>
    dividerFootDrift(ov, Math.max(0, dividerTopZ - railBandLo));
  const blockCrossing = (
    side: LidCompatibilitySide,
    at: number,
    halfSpan: number,
    sweep: number
  ): void => {
    blockSpan(side, at - halfSpan + Math.min(0, sweep), at + halfSpan + Math.max(0, sweep));
  };

  // Column boundaries run along Y and can terminate on the front and back
  // walls. `findPairAwareRuns` splits them exactly where the wall builder does,
  // so a run's `offsetStart`/`offsetEnd` belong to the pair that owns it.
  for (let boundary = 1; boundary < cols; boundary++) {
    const xPos = -innerW / 2 + boundary * cellW;
    const runs = findPairAwareRuns(rows, (row) => {
      const leftId = cells[row * cols + (boundary - 1)];
      const rightId = cells[row * cols + boundary];
      return leftId !== rightId ? overrideKey(leftId, rightId) : null;
    });
    for (const run of runs) {
      const ov = lookup.get(run.pairKey);
      // Sign convention mirrors `buildCompartmentWallsInScope`: `offsetStart`
      // shifts the lower-coordinate endpoint, `offsetEnd` the higher one.
      const startX = xPos + (ov?.offsetStart ?? 0);
      const endX = xPos + (ov?.offsetEnd ?? 0);
      const segLen = (run.end - run.start) * cellD;
      const halfSpan = crossingHalfSpan(thickness, segLen, endX - startX);
      const sweep = leanSweep(ov);
      if (run.start === 0) blockCrossing('front', startX, halfSpan, sweep);
      if (run.end === rows) blockCrossing('back', endX, halfSpan, sweep);
      // A boundary close enough to a side wall runs THROUGH that wall's rail
      // rather than across it, so it denies the whole run rather than a
      // crossing. It takes a cell narrower than the rail's 3.35mm inboard reach
      // that still clears the viability guard above, which on the stock 42mm
      // pitch is impossible and on a small custom pitch is not.
      const yLo = -innerD / 2 + run.start * cellD;
      const yHi = -innerD / 2 + run.end * cellD;
      if (Math.max(startX, endX) + half > railInnerX) blockSpan('right', yLo, yHi);
      if (Math.min(startX, endX) - half < -railInnerX) blockSpan('left', yLo, yHi);
    }
  }

  // Row boundaries run along X and can terminate on the left and right walls.
  for (let boundary = 1; boundary < rows; boundary++) {
    const yPos = -innerD / 2 + boundary * cellD;
    const runs = findPairAwareRuns(cols, (col) => {
      const frontId = cells[(boundary - 1) * cols + col];
      const backId = cells[boundary * cols + col];
      return frontId !== backId ? overrideKey(frontId, backId) : null;
    });
    for (const run of runs) {
      const ov = lookup.get(run.pairKey);
      const startY = yPos + (ov?.offsetStart ?? 0);
      const endY = yPos + (ov?.offsetEnd ?? 0);
      const segLen = (run.end - run.start) * cellW;
      const halfSpan = crossingHalfSpan(thickness, segLen, endY - startY);
      const sweep = leanSweep(ov);
      if (run.start === 0) blockCrossing('left', startY, halfSpan, sweep);
      if (run.end === cols) blockCrossing('right', endY, halfSpan, sweep);
      const xLo = -innerW / 2 + run.start * cellW;
      const xHi = -innerW / 2 + run.end * cellW;
      if (Math.max(startY, endY) + half > railInnerY) blockSpan('back', xLo, xHi);
      if (Math.min(startY, endY) - half < -railInnerY) blockSpan('front', xLo, xHi);
    }
  }

  return out;
}

/** Walls that lose rail to a divider. Drives the panel's warning row. */
export function dividerRailSides(
  blocks: readonly DividerRailBlock[]
): readonly LidCompatibilitySide[] {
  const sides = new Set(blocks.map((b) => b.side));
  return (['front', 'back', 'left', 'right'] as const).filter((s) => sides.has(s));
}
