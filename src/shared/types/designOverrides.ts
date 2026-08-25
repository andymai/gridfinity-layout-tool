/**
 * Variants: one design kept in step with another, except for a small set of
 * values the user has claimed.
 *
 * The overrides carry their VALUES, not just which fields are claimed, so a
 * variant's params can be rebuilt from the parent alone. That is what lets
 * propagation be a pure recompute rather than a three-way merge.
 */

/** Top-level `BinParams` scalars a variant may claim. */
export interface DimensionOverride {
  readonly width?: number;
  readonly depth?: number;
  readonly height?: number;
  readonly wallThickness?: number;
}

/**
 * Per-cutout values a variant may claim.
 *
 * Deliberately excludes `x`/`y`: position is what the parent arranges, and a
 * variant that moved a pocket would drift out of the layout the parent owns.
 * Size changes hold the pocket's center precisely so they do not become
 * position changes by accident.
 */
export interface CutoutOverride {
  readonly width?: number;
  readonly depth?: number;
  readonly cutDepth?: number;
  readonly clearance?: number;
  readonly chamferWidth?: number;
}

/** The fields a {@link CutoutOverride} may name, for UI iteration and validation. */
export const CUTOUT_OVERRIDE_FIELDS = [
  'width',
  'depth',
  'cutDepth',
  'clearance',
  'chamferWidth',
] as const;

export type CutoutOverrideField = (typeof CUTOUT_OVERRIDE_FIELDS)[number];

/** The fields a {@link DimensionOverride} may name. */
export const DIMENSION_OVERRIDE_FIELDS = ['width', 'depth', 'height', 'wallThickness'] as const;

export type DimensionOverrideField = (typeof DIMENSION_OVERRIDE_FIELDS)[number];

export interface DesignOverrides {
  readonly dimensions?: DimensionOverride;
  /**
   * Keyed by `Cutout.id`, never by array index: inserting one shape upstream
   * would silently repoint every index-keyed override at the wrong pocket.
   */
  readonly cutouts?: Readonly<Record<string, CutoutOverride>>;
}

/** An override naming a cutout the parent no longer has. */
export interface OrphanedOverride {
  readonly cutoutId: string;
  readonly override: CutoutOverride;
}

/** True when `overrides` claims nothing at all. */
export function isEmptyOverrides(overrides: DesignOverrides | undefined): boolean {
  if (!overrides) return true;
  const dimensionCount = Object.values(overrides.dimensions ?? {}).filter(
    (v) => v !== undefined
  ).length;
  if (dimensionCount > 0) return false;
  return Object.values(overrides.cutouts ?? {}).every(
    (cutout) => Object.values(cutout).filter((v) => v !== undefined).length === 0
  );
}
