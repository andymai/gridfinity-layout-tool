/**
 * Cross-section shape of an outer-wall taper for drawer-fit "curved" bins
 * (#2933). Lives in core alongside {@link OverhangConfig} so both the placed-bin
 * `Bin.marginTaper` and the bin-designer `WallTaperConfig` share one source.
 */
export type WallTaperProfile = 'chamfer' | 'fillet';

/**
 * Bottom-band taper on the outer wall for drawer-fit "curved" bins (#2933).
 *
 * The wall is full-width at the rim; over `bandHeight` it angles inward,
 * insetting each side by up to that side's overhang so the base returns toward
 * the nominal footprint (never below it). `profile` + `bandHeight` are shared;
 * per-side magnitude is the base inset (chamfer) or radius (fillet); 0 = that
 * side stays vertical. Requires overhang on a side for that side to taper.
 */
export interface WallTaperConfig {
  /** Absent (legacy) → enabled is inferred from any non-zero side. */
  readonly enabled?: boolean;
  readonly profile: WallTaperProfile;
  /** How far up the wall the taper rises, in mm (clamped to wall height at build). */
  readonly bandHeight: number;
  /** Per-side magnitude, mm (>= 0). Chamfer: base inset. Fillet: radius. */
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/**
 * Per-side outward expansion of a bin body, in mm.
 *
 * Each side grows the outer wall (and stacking lip) outward by the given
 * amount so the bin can fill a gap that an integral grid can't express — the
 * centering slack a drawer leaves, or the remainder when a span is divided
 * into pieces that aren't whole grid units. The base sockets/feet stay at the
 * nominal footprint, leaving a flat bottom under the overhang region: the
 * overhang does not protrude downward to fill an empty grid square.
 *
 * Values are outward-only (>= 0). All-zero (or omitted) means no overhang and
 * the bin uses the standard rectangle path with no geometry change.
 *
 * Coordinate convention matches the grid: `left`/`right` are -X/+X,
 * `front`/`back` are -Y/+Y.
 *
 * Lives in core rather than the designer because it describes both an authored
 * design parameter (`BinParams.overhang`) and a per-placement override
 * (`Bin.overhang`); `@/features/bin-designer/types` re-exports it so designer
 * code keeps its local import path.
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
  /**
   * Optional bottom-band taper on the outer wall (#2933). Insets within the
   * overhang region only — the base never goes below nominal, so feet never
   * protrude. Mutually exclusive with {@link feet} (frame feet would protrude
   * past the tapered base). Suppressed for custom-shape (`cellMask`) bins.
   */
  readonly taper?: WallTaperConfig;
}
