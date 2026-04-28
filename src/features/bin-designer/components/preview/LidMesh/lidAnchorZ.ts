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
