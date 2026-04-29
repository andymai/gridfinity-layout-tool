/**
 * Main-thread mirror of `lidAnchorZ()` and `lidWallBottomZ()` from
 * `@/features/generation/worker/generators/lidConstants`.
 *
 * The worker module isn't importable on the main thread (it pulls in
 * brepjs/WASM), so this file holds a pure-JS copy of the formulas used
 * by `LidMesh.tsx` and `useLidSection.ts` to position and size the lid
 * in the preview. Two contracts:
 *
 *   1. The formulas MUST match their worker-side counterparts in
 *      `@/features/generation/worker/generators/lidConstants` EXACTLY
 *      — drift produces a misaligned preview vs. exported geometry. The
 *      cross-thread agreement test in `LidMesh.test.tsx` enforces this.
 *   2. This file must contain only constants + pure functions (no React)
 *      so the consuming component file can stay react-refresh friendly.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Extra clearance baked into the anchor calculation
 *  (matches `LID_EXTRA_HEIGHT` in `@/features/generation/worker/generators/lidConstants`). */
export const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z in lid-local coords — the Y position where the lid's mating
 * cavity opens up to meet the bin's stacking lip when snapped.
 *
 * MUST MATCH `lidAnchorZ()` in
 * `@/features/generation/worker/generators/lidConstants` EXACTLY. If
 * either copy changes (formula, constants, sign), update both in
 * lockstep — silent drift produces a misaligned preview vs. exported
 * geometry.
 */
export function lidAnchorZ(heightUnitMm: number, fitClearance: number): number {
  return -heightUnitMm - LID_EXTRA_HEIGHT + GRIDFINITY.LIP_HEIGHT + Math.SQRT2 * fitClearance * 2;
}

/**
 * Bottom of the lid's mating wall in lid-local Z. Below this Z, the
 * mating wall ends and the click rails take over.
 *
 * MUST MATCH `lidWallBottomZ()` in
 * `@/features/generation/worker/generators/lidConstants` EXACTLY (same
 * cross-thread agreement requirement as `lidAnchorZ`).
 */
export function lidWallBottomZ(heightUnitMm: number, fitClearance: number): number {
  return (
    lidAnchorZ(heightUnitMm, fitClearance) - GRIDFINITY.LIP_BIG_TAPER - GRIDFINITY.LIP_VERTICAL_PART
  );
}
