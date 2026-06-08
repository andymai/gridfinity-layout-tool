/**
 * Complexity-aware timeouts for worker generation requests.
 *
 * The worker's CSG pipeline scales super-linearly with wall-pattern count and
 * bin height. A flat 30s timeout killed legitimate generations on tall bins
 * that combine hex patterns with wall cutouts (#1422). Baseplates hit the same
 * class of failure on large magnet grids — `cutInBatches` subtracts four holes
 * per cell and OCCT boolean time scales with cell count. This module computes
 * per-request timeouts from the params before the worker dispatches, each
 * capped so a runaway WASM loop can't hang the UI forever.
 */

import type { BaseplateParams, BinParams } from '@/shared/types/bin';

/** Minimum timeout for trivial bins (no heavy features). */
export const BASE_TIMEOUT_MS = 30_000;

/** Extra time granted when the hex wall pattern is enabled. */
export const HEX_PATTERN_BONUS_MS = 15_000;

/** Additional time when hex pattern combines with any active wall cutout. */
export const HEX_PLUS_CUTOUT_BONUS_MS = 15_000;

/**
 * Extra time per grid cell of footprint (width × depth) above the floor, granted
 * only when the hex pattern is enabled.
 *
 * The hex-pattern boolean cut (subtracting hundreds of hex prisms from the bin)
 * is the generation bottleneck, and its cost scales with wall *area*, not just
 * height — yet the other bonuses key off height and feature flags alone. A wide,
 * short hex bin (e.g. 16×16×4) therefore used to get only the base + hex budget
 * while legitimately needing far longer, and timed out mid-generation. This term
 * restores the missing area dimension. Gated on hex because a plain large bin
 * has no pattern cut and finishes quickly.
 */
export const HEX_FOOTPRINT_BONUS_MS_PER_CELL = 250;

/**
 * Footprint (in whole grid cells) below which no footprint bonus accrues — the
 * base budget already covers normal-sized bins. 16 = a 4×4 grid.
 */
export const HEX_FOOTPRINT_BONUS_FLOOR_CELLS = 16;

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
  // Defensive against transient bad inputs — mid-edit UI state can briefly
  // present NaN/negative dimensions. setTimeout(NaN) coerces to 0ms, which would
  // cancel the request before the worker can run. Floor bad dims to 0 (no
  // footprint/height bonus) and clamp the result below. Mirrors
  // computeBaseplateTimeoutMs.
  const safeWidth = Number.isFinite(params.width) && params.width > 0 ? params.width : 0;
  const safeDepth = Number.isFinite(params.depth) && params.depth > 0 ? params.depth : 0;
  const safeHeight = Number.isFinite(params.height) && params.height > 0 ? params.height : 0;

  let timeout = BASE_TIMEOUT_MS;

  const hasHexPattern = params.wallPattern.enabled;
  if (hasHexPattern) {
    timeout += HEX_PATTERN_BONUS_MS;
    if (hasAnyActiveCutoutSide(params)) {
      timeout += HEX_PLUS_CUTOUT_BONUS_MS;
    }
    // Round fractional grids up — a partial cell still carries a full cell's
    // worth of hex pattern-cut work along that edge.
    const cells = Math.ceil(safeWidth) * Math.ceil(safeDepth);
    const chargeableCells = Math.max(0, cells - HEX_FOOTPRINT_BONUS_FLOOR_CELLS);
    timeout += chargeableCells * HEX_FOOTPRINT_BONUS_MS_PER_CELL;
  }

  const heightOverFloor = Math.max(0, safeHeight - HEIGHT_BONUS_FLOOR_UNITS);
  const heightBuckets = Math.floor(heightOverFloor / HEIGHT_BONUS_BUCKET_UNITS);
  timeout += heightBuckets * HEIGHT_BONUS_MS;

  // Clamp to [BASE, MAX] — the guards above keep `timeout` finite, and this
  // makes the documented contract self-enforcing.
  return Math.max(BASE_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, timeout));
}

/** Per-cell cost of magnet-hole boolean subtractions, in ms. */
export const BASEPLATE_MAGNET_MS_PER_CELL = 200;

/** Upper bound on the magnet-hole bonus, even for very large grids. */
export const BASEPLATE_MAGNET_BONUS_CAP_MS = 60_000;

/** Bonus for split pieces with dovetail connector nubs/holes. */
export const BASEPLATE_CONNECTOR_BONUS_MS = 10_000;

/** Bonus for the lightweight floor-cut path. */
export const BASEPLATE_LIGHTWEIGHT_BONUS_MS = 5_000;

/**
 * Hard ceiling for baseplates. Higher than {@link MAX_TIMEOUT_MS} because
 * dense magnet grids (10u+ with holes) legitimately run longer than any
 * bin shape does — the batched-cut pipeline is serial per batch and OCCT
 * numerical precision work dominates.
 */
export const BASEPLATE_MAX_TIMEOUT_MS = 120_000;

/**
 * Compute the timeout budget for a baseplate generation, in milliseconds.
 *
 * Formula:
 *   BASE_TIMEOUT_MS
 * + min(BASEPLATE_MAGNET_BONUS_CAP_MS, ceil(w) * ceil(d) * BASEPLATE_MAGNET_MS_PER_CELL)  [if magnetHoles]
 * + BASEPLATE_CONNECTOR_BONUS_MS  [if connectorNubs]
 * + BASEPLATE_LIGHTWEIGHT_BONUS_MS  [if lightweight]
 *
 * Clamped to `[BASE_TIMEOUT_MS, BASEPLATE_MAX_TIMEOUT_MS]`.
 */
export function computeBaseplateTimeoutMs(params: BaseplateParams): number {
  // Defensive against transient bad inputs — mid-edit UI state can briefly
  // present NaN/negative dimensions. The generator's sanitizeParams will
  // reject them, but the bridge computes this timeout first and setTimeout
  // coerces NaN to 0, which would cancel the request before the worker can
  // surface a real error. Floor bad dims to 0 cells (no magnet bonus).
  const safeWidth = Number.isFinite(params.width) && params.width > 0 ? params.width : 0;
  const safeDepth = Number.isFinite(params.depth) && params.depth > 0 ? params.depth : 0;

  let timeout = BASE_TIMEOUT_MS;

  if (params.magnetHoles) {
    const cells = Math.ceil(safeWidth) * Math.ceil(safeDepth);
    timeout += Math.min(BASEPLATE_MAGNET_BONUS_CAP_MS, cells * BASEPLATE_MAGNET_MS_PER_CELL);
  }
  if (params.connectorNubs) {
    timeout += BASEPLATE_CONNECTOR_BONUS_MS;
  }
  // Match the generator's own convention — `baseplateGenerator.ts` runs the
  // lightweight floor-cut whenever `lightweight !== false`, so an omitted
  // field triggers the work and must earn the timeout allowance too.
  if (params.lightweight !== false) {
    timeout += BASEPLATE_LIGHTWEIGHT_BONUS_MS;
  }

  // Clamp to [BASE, MAX]. Redundant given the guards above, but makes the
  // documented contract self-enforcing if bonuses are ever signed or reworked.
  return Math.max(BASE_TIMEOUT_MS, Math.min(BASEPLATE_MAX_TIMEOUT_MS, timeout));
}
