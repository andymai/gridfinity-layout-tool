/**
 * Complexity-aware timeouts for worker generation requests.
 *
 * The worker's CSG pipeline scales super-linearly with wall-pattern count and
 * bin height. A flat 30s timeout killed legitimate generations on tall bins
 * that combine hex patterns with wall cutouts. Baseplates hit the same
 * class of failure on large magnet grids — `cutInBatches` subtracts four holes
 * per cell and OCCT boolean time scales with cell count. This module computes
 * per-request timeouts from the params before the worker dispatches, each
 * capped so a runaway WASM loop can't hang the UI forever.
 */

import type { ResolvedBaseplateParams, BinParams } from '@/shared/types/bin';
import { isKumikoPattern, isUndersideRelief } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { hasDetachableFeet } from '@/shared/types/bin';
import { resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import { resolveOverhang } from '@/shared/utils/overhang';

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
 * Extra time when a kumiko wrapped-lattice pattern is enabled.
 *
 * Kumiko builds cost far more than hex stamps: four corner cutters (partial
 * revolves + helix sweeps + booleans), a fused strut subtraction per flat
 * wall, and a heavier final pattern cut. A 1×1×6 mitsukude bin measures
 * ~60-80s on the single-threaded OCCT pipeline where a honeycomb equivalent
 * finishes in seconds.
 */
export const KUMIKO_PATTERN_BONUS_MS = 60_000;

/**
 * Per-perimeter-cell bonus for kumiko patterns. Lattice cost scales with the
 * wall PERIMETER (strut count around the loop), not footprint area, so this
 * keys off width + depth with no floor — even small bins pay the corner cost.
 */
export const KUMIKO_PERIMETER_BONUS_MS_PER_CELL = 7_000;

/**
 * Extra time per patterned compartment divider.
 *
 * Each divider adds its own pattern panel — a stamp compound or, for kumiko, a
 * full lattice subtraction — and every panel becomes another tool in the final
 * pattern cut, whose cost grows super-linearly with tool count. A 4x4 grid
 * carries six divider segments, so without a per-divider term a dense
 * multi-compartment bin can exhaust the flat pattern budget mid-generation and
 * hard-reset the worker.
 */
export const DIVIDER_PATTERN_MS_PER_SEGMENT = 6_000;

/** Kumiko divider panels cost far more than a stamp compound (see above). */
export const KUMIKO_DIVIDER_MS_PER_SEGMENT = 20_000;

/**
 * Extra time when the floor pattern is enabled.
 *
 * The floor cut is one pattern panel per socket cell, and each panel becomes a
 * tool in BOTH the body's pattern cut and a second cut against the base socket
 * — the only feature that booleans the socket at all.
 */
export const FLOOR_PATTERN_BONUS_MS = 15_000;

/**
 * Per-cell bonus for the floor pattern. One window per foot, so the cost tracks
 * footprint area directly with no floor — even a 1x1 bin pays for its panel.
 */
export const FLOOR_PATTERN_MS_PER_CELL = 2_000;

/**
 * Bonus for a wall taper on a multi-compartment bin.
 *
 * The multi-cavity path cuts compartments out of a *lofted* outer rather than a
 * prism, and the perimeter ones are clipped to the tapered inner envelope
 * first — both more expensive than the flat path. Measured on a 4x4u bin with a
 * 12x12 grid: 1.9s flat, 5.1s chamfer, 10.9s fillet (fillet samples up to 16
 * sections against chamfer's 2, so it is the worst case).
 *
 * That already fits the base budget; this is headroom for larger footprints,
 * where the loft grows with the perimeter.
 *
 * Single-cavity tapers get nothing — they build one loft and are not measurably
 * slower than the shelled path.
 */
export const TAPER_MULTI_COMPARTMENT_BONUS_MS = 10_000;

/** Per-compartment bonus for a tapered multi-compartment bin. */
export const TAPER_MS_PER_COMPARTMENT = 100;

/**
 * Bonus per 2 height units above the reference height.
 *
 * Applied **unconditionally** (not gated on the hex pattern) because tessellation
 * and boolean passes scale with wall area and feature count even on plain
 * extrusions — a 10u bin with only compartments still takes noticeably longer
 * than a 4u one. Hex-pattern bonuses stack on top when both apply.
 */
export const HEIGHT_BONUS_MS = 15_000;

/**
 * Fixed cost of building the detachable feet at all, in ms — the plan, the
 * shared pin template and the body's hole cut.
 */
export const DETACHABLE_FEET_BONUS_MS = 5_000;

/**
 * Per-foot cost, in ms. Each foot is a loft plus a clip intersect, then one
 * fuse per pin applied in sequence, and on a magnet or screw base a cut per
 * corner it covers.
 */
export const DETACHABLE_FEET_MS_PER_FOOT = 2_000;

/** Height (grid units) at which height bonuses start accruing. */
export const HEIGHT_BONUS_FLOOR_UNITS = 4;

/** Height-unit bucket size for bonus steps. */
export const HEIGHT_BONUS_BUCKET_UNITS = 2;

/**
 * Hard ceiling — protects users from runaway WASM OOM loops while still giving
 * legitimately complex bins room to finish.
 *
 * Heavy honeycomb bins run well past 90s on the single-threaded OCCT pipeline:
 * a 4×4×8 honeycomb bin's pattern cut alone is ~14s and a tall 6×6×20 is ~3min. The
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
 * on — a low-end laptop or a throttled mobile browser can easily take 5–6× as
 * long on the single-threaded OCCT pipeline. A flat multiplier models exactly
 * that hardware gap while preserving the relative ordering the complexity budget
 * already encodes (a hex bin still gets proportionally more than a trivial one).
 *
 * 6× rather than 4×: old phones and throttled mobile browsers routinely run
 * 5–6× the reference machine, and a smaller multiplier clamps mid-weight designs
 * just short of finishing and stops the heaviest honeycomb bins reaching the
 * ceiling below. Heavy honeycomb, big-magnet-grid and scoop+tall designs are the
 * ones that hit `ExportTimeoutError` when this is too low.
 */
export const EXPORT_TIMEOUT_MULTIPLIER = 6;

/**
 * Hard ceiling for exports — set far above the 3-minute preview cap because an
 * export is terminal and cancellable, so the only job of this clamp is to stop a
 * genuinely-wedged WASM heap from hanging forever, not to bound interactive
 * wait.
 *
 * 20 minutes so the heaviest known pipeline actually receives the 6× export
 * multiplier instead of being clamped back: a 6×6×20 honeycomb's ~3-minute
 * pattern cut runs ≈18 min at 6× on the slowest hardware, so a 15-minute cap
 * would truncate it. 20 minutes still bounds a wedged heap, and the progress bar + cancel button mean a user
 * who no longer wants to wait is never stuck.
 */
export const EXPORT_MAX_TIMEOUT_MS = 1_200_000;

/**
 * Count the cell boundaries that carry a patterned divider wall — an upper
 * bound on the pattern panels the worker will build, since contiguous same-pair
 * boundaries merge into one segment.
 *
 * Mirrors the worker's `dividerPatternsApply` gate so the budget doesn't grant
 * time for panels that can never be built: slotted bins print their dividers as
 * separate pieces, solid bins have no cavity, polygon footprints drop dividers
 * from the feature pipeline, and a zero-thickness grid has no walls at all.
 */
function countDividerSegments(params: BinParams): number {
  if (params.base.solid || params.style === 'solid') return 0;
  if (isPartialMask(params.cellMask)) return 0;

  // Slotted bins pattern their removable pieces instead. The piece count is
  // small and fixed by topology (one or two spanning pieces, plus at most two
  // short variants in insert mode), so charge a flat handful rather than
  // re-deriving the whole piece plan here.
  if (params.style === 'slotted') {
    if (params.dividerPieces.thickness <= 0) return 0;
    const axes = (params.slotConfig.x.enabled ? 1 : 0) + (params.slotConfig.y.enabled ? 1 : 0);
    return axes === 0 ? 0 : axes + 2;
  }

  if (params.compartments.thickness <= 0) return 0;
  const { cols, rows, cells } = params.compartments;
  if (cols <= 1 && rows <= 1) return 0;
  let count = 0;
  for (let col = 1; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (cells[row * cols + (col - 1)] !== cells[row * cols + col]) count++;
    }
  }
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (cells[(row - 1) * cols + col] !== cells[row * cols + col]) count++;
    }
  }
  return count;
}

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

    if (isKumikoPattern(params.wallPattern.pattern)) {
      timeout += KUMIKO_PATTERN_BONUS_MS;
      timeout += (Math.ceil(safeWidth) + Math.ceil(safeDepth)) * KUMIKO_PERIMETER_BONUS_MS_PER_CELL;
      // Filled patterns (everything beyond the bare mitsukude grid) carry
      // 3-4× the strut count and measure ~7× mitsukude's generation time.
      if (params.wallPattern.pattern !== 'mitsukude') {
        timeout += KUMIKO_PATTERN_BONUS_MS;
      }
    }

    if (params.wallPattern.dividers === true) {
      const segments = countDividerSegments(params);
      timeout +=
        segments *
        (isKumikoPattern(params.wallPattern.pattern)
          ? KUMIKO_DIVIDER_MS_PER_SEGMENT
          : DIVIDER_PATTERN_MS_PER_SEGMENT);
    }
  }

  // Mirrors the worker's `floorPatternApplies` gate — a solid base, or one
  // whose lite floor is open, never builds a floor panel, so it shouldn't be
  // granted time for one. The underside relief does build it.
  if (
    params.floorPattern?.enabled === true &&
    !params.base.solid &&
    params.style !== 'solid' &&
    !(params.base.lightweight && !isUndersideRelief(params.base)) &&
    !params.base.spacer
  ) {
    timeout += FLOOR_PATTERN_BONUS_MS;
    timeout += Math.ceil(safeWidth) * Math.ceil(safeDepth) * FLOOR_PATTERN_MS_PER_CELL;
  }

  // The taper only reaches the expensive multi-cavity path on a hollow bin with
  // more than one compartment. Resolved through the same helper the worker uses
  // rather than re-read off the raw config: that is what makes a polygon mask
  // (which drops the overhang entirely) and a legacy taper with `enabled`
  // absent-but-active agree with what actually gets built.
  const compartmentCount = new Set(params.compartments.cells).size;
  const taperOn =
    resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang).taper !== null;
  if (taperOn && !params.base.solid && compartmentCount > 1) {
    timeout += TAPER_MULTI_COMPARTMENT_BONUS_MS;
    timeout += compartmentCount * TAPER_MS_PER_COMPARTMENT;
  }

  // Detachable feet are extra solids on top of the bin, not a cheaper base: a
  // lofted foot and a clip intersect per placement, then a SEQUENTIAL fuse per
  // pin (folded one at a time on purpose — fuseAll returns a compound here),
  // plus the body cut. Paid on preview and export both, and it scales with the
  // foot count rather than the footprint, which is why it is per foot.
  if (hasDetachableFeet(params.base)) {
    timeout += DETACHABLE_FEET_BONUS_MS;
    timeout += resolveDetachableFeet(params).placements.length * DETACHABLE_FEET_MS_PER_FOOT;
  }

  const heightOverFloor = Math.max(0, safeHeight - HEIGHT_BONUS_FLOOR_UNITS);
  const heightBuckets = Math.floor(heightOverFloor / HEIGHT_BONUS_BUCKET_UNITS);
  timeout += heightBuckets * HEIGHT_BONUS_MS;

  return timeout;
}

/**
 * Multiplier applied to the device-aware estimate to derive `minTimeoutMs`.
 *
 * The estimate predicts this device's actual generation time from its own last
 * observed stage timings. Arming the preview timeout at `estimate * this` gives
 * a genuinely slow device proportional headroom over its own measured speed, so
 * a slow-but-progressing build is not hard-reset just because the static budget
 * (tuned on a faster reference machine) is tighter than the device needs.
 */
export const PREVIEW_TIMEOUT_SAFETY = 1.5;

/**
 * Compute the timeout budget for a live bin **preview** generation, in
 * milliseconds. Clamped to `[BASE_TIMEOUT_MS, MAX_TIMEOUT_MS]`.
 *
 * `minTimeoutMs` raises the budget floor (before the ceiling clamp) so a slow
 * device's own measured cost can win over the reference-tuned static budget. It
 * never lowers the budget, and the `MAX_TIMEOUT_MS` ceiling still bounds it.
 */
export function computeGenerationTimeoutMs(params: BinParams, minTimeoutMs = 0): number {
  // The raw budget is finite by construction (guards in binRawBudgetMs), so this
  // clamp also makes the documented contract self-enforcing.
  const floor = Math.max(binRawBudgetMs(params), Number.isFinite(minTimeoutMs) ? minTimeoutMs : 0);
  return Math.max(BASE_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, floor));
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
function baseplateRawBudgetMs(params: ResolvedBaseplateParams): number {
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
export function computeBaseplateTimeoutMs(params: ResolvedBaseplateParams): number {
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
export function computeBaseplateExportTimeoutMs(params: ResolvedBaseplateParams): number {
  const scaled = baseplateRawBudgetMs(params) * EXPORT_TIMEOUT_MULTIPLIER;
  return Math.max(BASE_TIMEOUT_MS, Math.min(EXPORT_MAX_TIMEOUT_MS, scaled));
}
