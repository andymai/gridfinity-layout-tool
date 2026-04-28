/**
 * Click-lock lid type definitions.
 *
 * The lid is a parametric companion piece of a bin design that mates with
 * the bin's stacking lip via angled rails on its underside. Its outer
 * footprint is auto-derived from the bin's dimensions (or cellMask polygon)
 * and its mating profile uses the bin's existing LIP_* constants so fit
 * tracks the lip spec automatically.
 */

/** Click-lock fit preset — maps to a clearance offset between lid and lip. */
export type LidFit = 'loose' | 'standard' | 'tight';

/**
 * Per-side clearance in mm between the lid's mating profile and the bin's
 * stacking lip surface. Applied as inset to the lid's BottomShape polygon.
 */
export const LID_FIT_CLEARANCE: Record<LidFit, number> = {
  loose: 0.3,
  standard: 0.2,
  tight: 0.1,
} as const;

/**
 * Available click-rail coverage options as a percentage of edge length.
 * Lower values save filament; higher values give more grip surface.
 * 100% = the historical edge-to-edge behavior.
 */
export const LID_CLICK_RAIL_COVERAGE_OPTIONS: readonly number[] = [50, 75, 100] as const;

/** Click-lock lid configuration. Stored as a sub-object on `BinParams`. */
export interface LidConfig {
  /** Master toggle. When false, no lid is generated regardless of other fields. */
  readonly enabled: boolean;
  /** Click-lock fit preset (clearance between lid and bin lip). */
  readonly fit: LidFit;
  /** Include Gridfinity stack-grid pattern on top of lid (other bins stack on it). */
  readonly stackableTop: boolean;
  /** Include magnet holes in the lid (uses bin's BaseConfig magnetDiameter). */
  readonly magnetHoles: boolean;
  /** Lid side-wall thickness in mm. Use a value from WALL_THICKNESS_OPTIONS. */
  readonly wallThickness: number;
  /** Lid top plate thickness in mm. Use a value from WALL_THICKNESS_OPTIONS. */
  readonly topThickness: number;
  /**
   * Click-rail coverage as a percentage of each wall's edge length (50–100).
   * Rails are always centered on their wall; lower values shorten them
   * symmetrically to save filament. Use a value from
   * `LID_CLICK_RAIL_COVERAGE_OPTIONS`.
   */
  readonly clickRailCoverage: number;
}

/** Default lid config: disabled. Sensible values for first-enable. */
export const DEFAULT_LID_CONFIG: LidConfig = {
  enabled: false,
  fit: 'standard',
  stackableTop: true,
  magnetHoles: false,
  wallThickness: 1.2,
  topThickness: 1.2,
  clickRailCoverage: 100,
} as const;
