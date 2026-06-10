/**
 * Nozzle-aware sizing for print-fit features (split-bin connectors, wall keys,
 * baseplate dovetail keys, snap clips).
 *
 * Every connector/lock dimension in this app was originally hand-tuned for a
 * 0.4mm nozzle. On a wider nozzle those features stop printing: walls fall below
 * two perimeters, sub-bead detail (e.g. a 0.45mm snap-clip barb) can't be laid
 * down at all, and press-fit clearances seize because the fatter bead overshoots
 * into the gap. These helpers scale the 0.4mm-tuned values up with the nozzle.
 *
 * Lives in `shared/` so the generation worker (which cuts the geometry) and the
 * baseplate feature (bed budget, previews, print guide) consume the SAME math —
 * the module-boundary rule forbids baseplate from importing the worker directly.
 *
 * Design invariant — ZERO REGRESSION AT 0.4mm: nozzle is a discrete setting
 * (step 0.2), so there is no continuity to preserve. Every function returns the
 * untouched 0.4mm-tuned input at `nozzle <= NOZZLE_BASELINE` and only diverges
 * above it. Existing 0.4mm designs, fits, and snapshot tests are unaffected.
 */

/** Nozzle the legacy feature dimensions were tuned for (mm). */
export const NOZZLE_BASELINE = 0.4;

/** Default perimeter floor for a structural feature wall (2 beads = slicer default). */
export const DEFAULT_FEATURE_PERIMETERS = 2;

/**
 * Extra per-side clearance added per mm of nozzle growth above the baseline (mm/mm).
 * A wider extrusion overshoots into the groove/pocket, so a press-fit tuned at
 * 0.4mm seizes at 0.6mm without this. 0.5 ≈ half a bead-width of slack per 1mm of
 * nozzle increase — at the 0.2mm setting step that's +0.1mm/side per step up.
 */
export const CLEARANCE_GROWTH_PER_MM = 0.5;

/**
 * Scale a 0.4mm-tuned feature size so it stays at least `perimeters` beads wide on
 * a larger nozzle. Returns `base04` unchanged at or below the baseline (no
 * regression); above it, the result is the larger of the legacy value and the
 * perimeter floor (`perimeters × nozzle`).
 *
 * @param base04 The dimension as tuned for a 0.4mm nozzle (mm).
 * @param nozzleSizeMm Current nozzle diameter (mm).
 * @param perimeters Minimum bead count this feature needs (default 2; pass 1 for
 *   slim single-bead detail like a barb that only needs to physically exist).
 */
export function scaleFeature(
  base04: number,
  nozzleSizeMm: number,
  perimeters: number = DEFAULT_FEATURE_PERIMETERS
): number {
  // A non-finite nozzle (corrupt persisted setting, bad imported design) would
  // otherwise propagate NaN into the geometry; treat it as the baseline.
  if (!Number.isFinite(nozzleSizeMm) || nozzleSizeMm <= NOZZLE_BASELINE) return base04;
  return Math.max(base04, perimeters * nozzleSizeMm);
}

/**
 * Grow a 0.4mm-tuned per-side clearance with bead width. Returns `base04`
 * unchanged at or below the baseline; above it, adds
 * `CLEARANCE_GROWTH_PER_MM × (nozzle − 0.4)`. The user's signed fit-offset still
 * rides on top of this (applied separately by `effectiveClearance`).
 */
export function scaleClearance(
  base04: number,
  nozzleSizeMm: number,
  growthPerMm: number = CLEARANCE_GROWTH_PER_MM
): number {
  // Guard against a non-finite nozzle so NaN can't leak into the groove clearance.
  const over = Number.isFinite(nozzleSizeMm) ? Math.max(0, nozzleSizeMm - NOZZLE_BASELINE) : 0;
  return base04 + growthPerMm * over;
}
