import type { LabelTabAlignment } from './labelTabs';

/** A single wall cutout: per-side override with its own enabled flag */
export interface WallCutout {
  /** Whether this side's cutout is individually enabled */
  readonly enabled: boolean;
  /** Width of the cutout as 0-100% of the wall span */
  readonly width: number;
  /** Depth of the cutout as 0-100% of the wall height (from top) */
  readonly depth: number;
  /** Horizontal alignment of the cutout within the wall span */
  readonly alignment: LabelTabAlignment;
  /** Horizontal offset from the alignment anchor in mm (positive = toward right/back) */
  readonly offset: number;
  /** Absolute cutout width in mm. When null, the percentage `width` field is used instead. */
  readonly widthMm: number | null;
}

/** Wall side identifier for per-side operations */
export type WallSide = 'front' | 'back' | 'left' | 'right' | 'interior';

/** Cutout shape style: u-shape (rectangular notch), scoop (semicircle), funnel (tapered U) */
export type WallCutoutShape = 'u-shape' | 'scoop' | 'funnel';

/** Wall cutout configuration: global defaults + per-side overrides */
export interface WallConfig {
  /** Master toggle for the wall cutouts feature */
  readonly enabled: boolean;
  /** Cutout shape applied globally to all sides */
  readonly shape: WallCutoutShape;
  /** Global default width % (0-100) applied to sides without individual overrides */
  readonly width: number;
  /** Global default depth % (0-100) applied to sides without individual overrides */
  readonly depth: number;
  readonly front: WallCutout;
  readonly back: WallCutout;
  readonly left: WallCutout;
  readonly right: WallCutout;
  /** Uniform cutout applied to all interior compartment divider walls */
  readonly interior: WallCutout;
}

/**
 * Per-side outward expansion of the bin body, in mm.
 *
 * Each side grows the outer wall (and stacking lip) outward by the given
 * amount so the bin can fill the centering gap left when an integral grid
 * doesn't perfectly fit a drawer. The base sockets/feet stay at the nominal
 * footprint, leaving a flat bottom under the overhang region — the overhang
 * does not protrude downward to fill an empty grid square.
 *
 * Values are outward-only (>= 0). All-zero (or omitted) means no overhang and
 * the bin uses the standard rectangle path with no geometry change.
 *
 * Coordinate convention matches the grid: `left`/`right` are -X/+X,
 * `front`/`back` are -Y/+Y.
 */
export interface OverhangConfig {
  /** Absent (legacy designs) → enabled is inferred from any non-zero side. */
  readonly enabled?: boolean;
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
  /**
   * When true, add grid-aligned gridfinity feet under the overhang region
   * (clipped feet in any strip/corner wide enough to print; flat elsewhere).
   * When false (default), the overhang has a flat bottom — feet stay at the
   * nominal footprint.
   *
   * Compatibility rule: these feet seat in an over-tiled baseplate's edge
   * pockets only when the per-side overhang equals the baseplate's per-side
   * padding (and the bin sits against that wall). Both use the same `frameCells`
   * layout, and the foot is `CLEARANCE` smaller than the pocket — see
   * `overtileFit.scenario.test.ts`.
   */
  readonly feet?: boolean;
}

/** Overhang-section hover-highlight target: a wall side or the bottom feet ring. */
export type OverhangHighlightSide = 'left' | 'right' | 'front' | 'back' | 'feet';

// Wall Pattern Types

/**
 * Canonical list of wall pattern types — the single source the union type,
 * the persisted-value allowlist (VALID_WALL_PATTERNS), and the registry all
 * derive from, so a new pattern can't ship in the picker while migration
 * still coerces its saved designs back to honeycomb.
 */
export const WALL_PATTERN_TYPES = [
  'honeycomb',
  'round',
  'diamond',
  'triangle',
  'slots',
  'mitsukude',
  'goma',
  'asanoha',
  'sakura',
  'rindo',
  'mikado',
  'tsumiishi-kikko',
] as const;

/** Supported wall pattern types. Extensible via pattern registry. */
export type WallPatternType = (typeof WALL_PATTERN_TYPES)[number];

/**
 * Kumiko wrapped-lattice pattern types — built by the perimeter-wrap pipeline
 * (continuous lattice around all four walls and corners) rather than the
 * per-wall stamp pipeline. Drives UI grouping and generation-cost budgeting.
 */
export const KUMIKO_PATTERN_TYPES = [
  'mitsukude',
  'goma',
  'asanoha',
  'sakura',
  'rindo',
  'mikado',
  'tsumiishi-kikko',
] as const satisfies readonly WallPatternType[];

/** Whether a pattern type is a kumiko wrapped-lattice pattern. */
export function isKumikoPattern(pattern: WallPatternType): boolean {
  return (KUMIKO_PATTERN_TYPES as readonly WallPatternType[]).includes(pattern);
}

/** Neutral pattern scale — reproduces each pattern's legacy element size. */
export const DEFAULT_PATTERN_SCALE = 0.5;

/** Wall pattern configuration — stored per design in BinParams */
export interface WallPatternConfig {
  readonly enabled: boolean;
  readonly pattern: WallPatternType;
  /**
   * Normalized element scale in [0, 1] — finer (0) to bolder (1); 0.5 is
   * neutral. Optional for back-compat with pre-scale saved designs; migration
   * backfills it and the geometry layer defaults + clamps untrusted values.
   */
  readonly scale?: number;
  /**
   * Carry the same pattern (and scale) through the compartment divider walls,
   * not just the outer walls. Optional for back-compat with saved designs;
   * migration backfills it and the geometry layer treats anything but `true`
   * as off.
   */
  readonly dividers?: boolean;
}
