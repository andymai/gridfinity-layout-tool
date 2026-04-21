/**
 * Complexity-aware timeout for bin generation requests.
 *
 * The worker's CSG pipeline scales super-linearly with wall-pattern count and
 * bin height. A flat 30s timeout killed legitimate generations on tall bins
 * that combine hex patterns with wall cutouts (#1422). This module computes a
 * per-request timeout from the BinParams before the worker dispatches, capped
 * so a runaway WASM loop can't hang the UI forever.
 */

import type { BinParams } from '@/shared/types/bin';

/** Minimum timeout for trivial bins (no heavy features). */
export const BASE_TIMEOUT_MS = 30_000;

/** Extra time granted when the hex wall pattern is enabled. */
export const HEX_PATTERN_BONUS_MS = 15_000;

/** Additional time when hex pattern combines with any active wall cutout. */
export const HEX_PLUS_CUTOUT_BONUS_MS = 15_000;

/**
 * Bonus per 2 height units above the reference height.
 *
 * Applied **unconditionally** (not gated on the hex pattern) because tessellation
 * and boolean passes scale with wall area and feature count even on plain
 * extrusions — a 10u bin with only compartments still takes noticeably longer
 * than a 4u one. Hex-pattern bonuses stack on top when both apply.
 */
export const HEIGHT_BONUS_MS = 15_000;

/** Height (grid units) at which height bonuses start accruing. */
export const HEIGHT_BONUS_FLOOR_UNITS = 4;

/** Height-unit bucket size for bonus steps. */
export const HEIGHT_BONUS_BUCKET_UNITS = 2;

/** Hard ceiling — protects users from runaway WASM OOM loops. */
export const MAX_TIMEOUT_MS = 90_000;

function hasAnyActiveCutoutSide(params: BinParams): boolean {
  const { walls } = params;
  if (!walls.enabled) return false;
  return (
    walls.front.enabled ||
    walls.back.enabled ||
    walls.left.enabled ||
    walls.right.enabled ||
    walls.interior.enabled
  );
}

/**
 * Compute the timeout budget for a bin generation, in milliseconds.
 *
 * Clamped to `[BASE_TIMEOUT_MS, MAX_TIMEOUT_MS]`.
 */
export function computeGenerationTimeoutMs(params: BinParams): number {
  let timeout = BASE_TIMEOUT_MS;

  const hasHexPattern = params.wallPattern.enabled;
  if (hasHexPattern) {
    timeout += HEX_PATTERN_BONUS_MS;
    if (hasAnyActiveCutoutSide(params)) {
      timeout += HEX_PLUS_CUTOUT_BONUS_MS;
    }
  }

  const heightOverFloor = Math.max(0, params.height - HEIGHT_BONUS_FLOOR_UNITS);
  const heightBuckets = Math.floor(heightOverFloor / HEIGHT_BONUS_BUCKET_UNITS);
  timeout += heightBuckets * HEIGHT_BONUS_MS;

  return Math.min(MAX_TIMEOUT_MS, timeout);
}
