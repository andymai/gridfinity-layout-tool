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
}
