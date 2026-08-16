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
  /**
   * Round-over (mm) on the shoulder where this cut meets the top of the
   * material. Null defers to {@link WallConfig.cornerRadiusTop}.
   */
  readonly cornerRadiusTop?: number | null;
  /**
   * Fillet (mm) at the bottom of this cut. Null defers to
   * {@link WallConfig.cornerRadiusBottom}.
   */
  readonly cornerRadiusBottom?: number | null;
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
  /**
   * Default shoulder round-over (mm) for sides that set no radius of their own.
   * Null (or absent, on a design saved before the control existed) means
   * square, which is the shape every such design already has.
   */
  readonly cornerRadiusTop?: number | null;
  /**
   * Default bottom fillet (mm) for sides that set none. Null means the
   * automatic 15%-of-span rule the builder has always applied.
   */
  readonly cornerRadiusBottom?: number | null;
  readonly front: WallCutout;
  readonly back: WallCutout;
  readonly left: WallCutout;
  readonly right: WallCutout;
  /** Uniform cutout applied to all interior compartment divider walls */
  readonly interior: WallCutout;
}

// Canonical home is `@/core/types` — it describes both `BinParams.overhang`
// (authored) and `Bin.overhang` (per-placement), so core can't import it from
// here. Re-exported so designer code keeps its local import path.
export type { OverhangConfig, WallTaperConfig } from '@/core/types/overhang';

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

/** The four outer walls a pattern can be applied to, in side-selector order. */
export const WALL_PATTERN_SIDES = ['left', 'right', 'front', 'back'] as const;

/** Which outer walls carry the wall pattern. */
export type WallPatternSides = Record<(typeof WALL_PATTERN_SIDES)[number], boolean>;

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
  /**
   * Which outer walls carry the pattern. Optional for back-compat with
   * saved designs; migration backfills it and the geometry layer treats a
   * missing side as ON, so a older design keeps patterning all four walls.
   */
  readonly sides?: WallPatternSides;
}
