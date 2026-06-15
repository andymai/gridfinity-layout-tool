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

/**
 * Hard ceiling — protects users from runaway WASM OOM loops while still giving
 * legitimately complex bins room to finish.
 *
 * Raised from 90s to 180s (#timeouts): measured generation of heavy honeycomb
 * bins runs well past 90s on the single-threaded OCCT pipeline — e.g. a 4×4×8
 * honeycomb bin's pattern cut alone is ~14s and a tall 6×6×20 is ~3min. The
 * boolean `pattern_cut` stage is ~82% of total and scales super-linearly, so the
 * batch cut is already near-optimal and can't be meaningfully parallelized
 * (splitting the solid forces a recombine that costs more than it saves). Until
 * the pattern cut itself is optimized, a 3-minute ceiling stops the bulk of
 * spurious timeouts on bins that would otherwise finish. 3 minutes is the agreed
 * upper bound on how long a user should wait (with progress + cancel).
 */
export const MAX_TIMEOUT_MS = 180_000;

/**
 * Multiplier applied to the complexity-derived budget when the request is a
 * user-initiated **export** rather than a live preview.
 *
 * The preview ceilings ({@link MAX_TIMEOUT_MS}, {@link BASEPLATE_MAX_TIMEOUT_MS})
 * are tuned for "how long a user should wait while iterating" on a *reference*
 * machine. An export is different on two axes: the user has explicitly committed
 * to it (clicked Export, will wait, can cancel) AND it runs on *their* hardware,
 * which can be several times slower than the machine these budgets were measured
 * on — a low-end laptop or a throttled mobile browser can easily take 3–4× as
 * long on the single-threaded OCCT pipeline. A flat multiplier models exactly
 * that hardware gap while preserving the relative ordering the complexity budget
 * already encodes (a hex bin still gets proportionally more than a trivial one).
 */
export const EXPORT_TIMEOUT_MULTIPLIER = 4;

/**
 * Hard ceiling for exports — set far above the 3-minute preview cap because an
 * export is terminal and cancellable, so the only job of this clamp is to stop a
 * genuinely-wedged WASM heap from hanging forever, not to bound interactive
 * wait. 15 minutes comfortably covers the heaviest known pipeline (a 6×6×20
 * honeycomb's ~3-minute pattern cut, ×4 for slow hardware ≈ 12 min) with margin.
 */
export const EXPORT_MAX_TIMEOUT_MS = 900_000;

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
 * Uncapped complexity budget for a bin, in milliseconds — the raw sum of the
 * base budget plus every applicable bonus, before any ceiling is applied. Kept
 * separate from the clamping so preview and export can share one cost model and
 * differ only in their ceiling (and the export multiplier).
 */
function binRawBudgetMs(params: BinParams): number {
  // Defensive against transient bad inputs — mid-edit UI state can briefly
  // present NaN/negative dimensions. setTimeout(NaN) coerces to 0ms, which would
  // cancel the request before the worker can run. Floor bad dims to 0 (no
  // footprint/height bonus); callers clamp to BASE below. Mirrors
  // baseplateRawBudgetMs.
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

  return timeout;
}

/**
 * Compute the timeout budget for a live bin **preview** generation, in
 * milliseconds. Clamped to `[BASE_TIMEOUT_MS, MAX_TIMEOUT_MS]`.
 */
export function computeGenerationTimeoutMs(params: BinParams): number {
  // The raw budget is finite by construction (guards in binRawBudgetMs), so this
  // clamp also makes the documented contract self-enforcing.
  return Math.max(BASE_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, binRawBudgetMs(params)));
}

/**
 * Compute the timeout budget for a user-initiated bin **export**, in
 * milliseconds. Same complexity cost model as the preview, scaled by
 * {@link EXPORT_TIMEOUT_MULTIPLIER} for slower user hardware and clamped to
 * `[BASE_TIMEOUT_MS, EXPORT_MAX_TIMEOUT_MS]`.
 */
export function computeExportTimeoutMs(params: BinParams): number {
  const scaled = binRawBudgetMs(params) * EXPORT_TIMEOUT_MULTIPLIER;
  return Math.max(BASE_TIMEOUT_MS, Math.min(EXPORT_MAX_TIMEOUT_MS, scaled));
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
 * Hard ceiling for baseplates. Unified with {@link MAX_TIMEOUT_MS} at the agreed
 * 3-minute cap: honeycomb bins are now the heaviest pipeline (their pattern cut
 * can reach ~3min), so baseplates no longer warrant a higher ceiling than bins.
 * Baseplate raw budgets max out near ~105s anyway (magnet bonus is capped), so
 * this is a defensive clamp that is effectively never hit.
 */
export const BASEPLATE_MAX_TIMEOUT_MS = 180_000;

/**
 * Uncapped complexity budget for a baseplate, in milliseconds — the raw sum of
 * the base budget plus every applicable bonus, before any ceiling is applied.
 * Shared by the preview and export budgets (see {@link binRawBudgetMs}).
 *
 * Formula:
 *   BASE_TIMEOUT_MS
 * + min(BASEPLATE_MAGNET_BONUS_CAP_MS, ceil(w) * ceil(d) * BASEPLATE_MAGNET_MS_PER_CELL)  [if magnetHoles]
 * + BASEPLATE_CONNECTOR_BONUS_MS  [if connectorNubs]
 * + BASEPLATE_LIGHTWEIGHT_BONUS_MS  [if lightweight]
 */
function baseplateRawBudgetMs(params: BaseplateParams): number {
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

  return timeout;
}

/**
 * Compute the timeout budget for a live baseplate **preview** generation, in
 * milliseconds. Clamped to `[BASE_TIMEOUT_MS, BASEPLATE_MAX_TIMEOUT_MS]`.
 */
export function computeBaseplateTimeoutMs(params: BaseplateParams): number {
  // The raw budget is finite by construction (guards in baseplateRawBudgetMs),
  // so this clamp also makes the documented contract self-enforcing.
  return Math.max(
    BASE_TIMEOUT_MS,
    Math.min(BASEPLATE_MAX_TIMEOUT_MS, baseplateRawBudgetMs(params))
  );
}

/**
 * Compute the timeout budget for a user-initiated baseplate **export**, in
 * milliseconds. Same complexity cost model as the preview, scaled by
 * {@link EXPORT_TIMEOUT_MULTIPLIER} for slower user hardware and clamped to
 * `[BASE_TIMEOUT_MS, EXPORT_MAX_TIMEOUT_MS]`.
 */
export function computeBaseplateExportTimeoutMs(params: BaseplateParams): number {
  const scaled = baseplateRawBudgetMs(params) * EXPORT_TIMEOUT_MULTIPLIER;
  return Math.max(BASE_TIMEOUT_MS, Math.min(EXPORT_MAX_TIMEOUT_MS, scaled));
}
