/**
 * Community print records: proof that a published design was actually printed.
 *
 * One record per user per design, editable in place, so "printed by N" is a
 * distinct-printer count by construction and cannot be inflated by posting
 * more. This is the showcase's primary merit signal; see the vision doc's
 * "utility over engagement" framing.
 *
 * MIRROR: every tuple/constant here must match the identically-named export in
 * `api/lib/communityPrintValidation.ts` (api/ cannot import from src/, so the
 * members are duplicated, not shared). Update both sides together; the
 * cross-boundary equality test in `communityPrint.test.ts` guards against drift.
 */

/** Registered in scripts/check-union-exhaustiveness.sh. */
export const COMMUNITY_PRINT_MATERIALS = ['pla', 'petg', 'abs', 'asa', 'tpu', 'other'] as const;

export type CommunityPrintMaterial = (typeof COMMUNITY_PRINT_MATERIALS)[number];

/**
 * Did the design work as published?
 *
 * The highest-value field in the feature: "8 as designed, 4 adjusted" is
 * decision-grade information for the next printer, and unlike a like or a
 * view it cannot be produced without having printed the thing.
 * Registered in scripts/check-union-exhaustiveness.sh.
 */
export const COMMUNITY_PRINT_FIT_VERDICTS = ['as-designed', 'adjusted', 'did-not-fit'] as const;

export type CommunityPrintFitVerdict = (typeof COMMUNITY_PRINT_FIT_VERDICTS)[number];

/**
 * `hidden` = auto-hidden after the report threshold or a deny-listed author;
 * `removed` = owner delete / admin purge. Mirrors CommunityDesignStatus so the
 * moderation vocabulary stays one concept across the feature.
 * Registered in scripts/check-union-exhaustiveness.sh.
 */
export type CommunityPrintStatus = 'live' | 'hidden' | 'removed';

export const COMMUNITY_PRINT_MAX_PHOTOS = 4;
export const COMMUNITY_PRINT_NOTE_MAX_LENGTH = 200;
export const COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH = 40;

/**
 * Longest edge the client downscales a photo to before uploading. The canvas
 * re-encode that enforces this is also what drops EXIF (GPS included): a
 * re-encode writes a fresh WebP stream with no metadata chunks carried over.
 */
export const COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX = 1200;

/** Post-re-encode ceiling, enforced client-side before upload and server-side on receipt. */
export const COMMUNITY_PRINT_PHOTO_MAX_BYTES = 400_000;

/**
 * Longest edge of the browsing-sized copy stored alongside each photo.
 *
 * Every surface that lists photos renders them small — a 78px filmstrip tile,
 * a 117px print-grid cell, a ~200px gallery card — while the stored photo is
 * 1200px. Sending the full one to those was ~295KB of overdraw on a single
 * detail view. 400 covers the largest of those slots at 2x without becoming a
 * second full-size asset.
 */
export const COMMUNITY_PRINT_THUMB_MAX_EDGE_PX = 400;

/**
 * A third of the full photo's ceiling. Scaled by area a 400px copy is ~9x
 * smaller, so this is loose enough that the quality ladder never has to reach
 * for it and tight enough that a client cannot smuggle a full-size image
 * through the thumbnail field.
 */
export const COMMUNITY_PRINT_THUMB_MAX_BYTES = 120_000;

/**
 * Inclusive numeric bounds. Wide enough for real hardware (0.1mm micro nozzles
 * through 2.0mm high-flow), tight enough that a fat-fingered entry cannot skew
 * an aggregate summary.
 */
export const COMMUNITY_PRINT_RANGES = {
  nozzleMm: { min: 0.1, max: 2 },
  layerHeightMm: { min: 0.02, max: 1.2 },
  printMinutes: { min: 1, max: 10_000 },
  filamentGrams: { min: 0.1, max: 10_000 },
} as const;

/**
 * Print settings as reported by the printer. Every field is enum or numeric so
 * a design's prints aggregate into "usually 0.2mm PLA, ~2h" without parsing
 * free text.
 *
 * Every field is optional: sharing a photo of the thing you printed is the
 * point, and demanding a slicer's numbers before accepting one makes a
 * 15-second contribution a data-entry chore. What a reporter fills in still
 * aggregates; what they leave out is absent, never zero.
 */
export interface CommunityPrintSettings {
  readonly material?: CommunityPrintMaterial;
  readonly nozzleMm?: number;
  readonly layerHeightMm?: number;
  readonly printMinutes?: number;
  /** Ground truth that calibrates the model-derived filament estimate. */
  readonly filamentGrams?: number;
  /** A `COMMUNITY_PRINTERS` id, or 'other' paired with `printerOther`. */
  readonly printer?: string;
  /** Free-text model, present only when `printer` is 'other'. */
  readonly printerOther?: string;
}

export interface CommunityPrint {
  /** `<designId>:<authorPublicId>`: the pair IS the identity, so no reverse index is needed. */
  readonly id: string;
  readonly designId: string;
  /** Same salted-hash derivation as a design's author id, never the raw userId. */
  readonly authorPublicId: string;
  readonly authorName: string;
  readonly photos: readonly string[];
  /**
   * Browsing-sized copy per photo, same order, '' where a photo has none
   * (uploaded before the field existed, or already small enough to be its
   * own). Optional so pre-field fixtures and cached responses keep parsing.
   */
  readonly photoThumbs?: readonly string[];
  readonly settings: CommunityPrintSettings;
  readonly fitVerdict: CommunityPrintFitVerdict;
  readonly note: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: CommunityPrintStatus;
}

/**
 * Derived rollup shown above the print list, and the only place most visitors
 * will look. Modes rather than means: "usually 0.2mm" survives one outlier
 * entry in a way an average does not.
 */
export interface CommunityPrintSummary {
  readonly count: number;
  readonly asDesigned: number;
  readonly adjusted: number;
  readonly didNotFit: number;
  /** Modal material across prints, null when there are none. */
  readonly commonMaterial: CommunityPrintMaterial | null;
  /** Modal layer height in mm, null when there are none. */
  readonly commonLayerHeightMm: number | null;
  /** Median print time in minutes, null when there are none. */
  readonly medianPrintMinutes: number | null;
  /** Median filament grams across prints that reported it, null when none did. */
  readonly medianFilamentGrams: number | null;
}

export function communityPrintId(designId: string, authorPublicId: string): string {
  return `${designId}:${authorPublicId}`;
}
