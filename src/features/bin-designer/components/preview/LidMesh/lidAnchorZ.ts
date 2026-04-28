/**
 * Main-thread mirror of `lidAnchorZ()` from
 * `@/features/generation/worker/generators/lidConstants`.
 *
 * The worker module isn't importable on the main thread (it pulls in
 * brepjs/WASM), so this file holds a pure-JS copy of the formula used
 * by `LidMesh.tsx` to position the lid in the preview. Two contracts:
 *
 *   1. The formula MUST match `lidAnchorZ()` in lidConstants.ts exactly
 *      — drift produces a misaligned preview vs. exported geometry. The
 *      cross-thread agreement test in `LidMesh.test.tsx` enforces this.
 *   2. This file must contain only constants + pure functions (no React)
 *      so the consuming component file can stay react-refresh friendly.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Extra clearance baked into the anchor calculation (matches lidConstants.LID_EXTRA_HEIGHT). */
export const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z in lid-local coords — the Y position where the lid's mating
 * cavity opens up to meet the bin's stacking lip when snapped.
 *
 * MUST MATCH `lidAnchorZ()` in `lidConstants.ts` EXACTLY. If either
 * copy changes (formula, constants, sign), update both in lockstep —
 * silent drift produces a misaligned preview vs. exported geometry.
 */
export function lidAnchorZ(heightUnitMm: number, fitClearance: number): number {
  return -heightUnitMm - LID_EXTRA_HEIGHT + GRIDFINITY.LIP_HEIGHT + Math.SQRT2 * fitClearance * 2;
}

/**
 * Vertical extent of the mating shell + click rails BELOW the anchor
 * line, in lid-local mm. Used by the preview to position the lid so
 * its rail tips rest at the bin's lip top instead of letting the
 * mating cavity wrap the lip (which would visually hide most of the
 * lid inside the bin's vertical extent).
 *
 * Sum of the worker-side constants from `lidConstants.ts` /
 * `generatorConstants.ts`:
 *   LIP_BIG_TAPER (1.9) + LIP_VERTICAL_PART (1.8) +
 *   LID_CLICK_RAIL_DROP (0.8) + LID_CLICK_RAIL_TAIL (1.25) = 5.75
 *
 * Independent of `heightUnitMm` and `fitClearance` (those are absorbed
 * into `lidAnchorZ`), so a single mm offset is sufficient. The
 * cross-thread test in `LidMesh.test.tsx` imports the worker-side
 * constants and asserts the sum still equals this number — drift
 * fails CI immediately.
 */
export const LID_RAIL_BELOW_ANCHOR_MM = 5.75;

/**
 * Lid's lowest local Z — where the click-rail tail tips reach. Used to
 * position the lid above the bin in the preview's "closed" state.
 */
export function lidLowestZ(heightUnitMm: number, fitClearance: number): number {
  return lidAnchorZ(heightUnitMm, fitClearance) - LID_RAIL_BELOW_ANCHOR_MM;
}
