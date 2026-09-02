/**
 * Shared scoop calculation utilities.
 *
 * Provides functions for resolving a scoop's two-axis profile (run along the
 * floor + rise up the wall) and computing lip offset. Used by
 * scoopRampBuilder.ts, GhostScoops.tsx, and printEstimates.ts to keep scoop
 * geometry consistent across generation, preview, and estimates.
 */

import { DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
// The leaf module, not the `@/shared/types/bin` barrel: that barrel re-exports
// `lidCompatibility`, which imports this file. `types/lid` is the shared home
// for lid geometry constants — it exists precisely because the preview and the
// worker both need them and the worker's own `lidConstants` pulls in brepjs —
// and `@/shared/types/bin` re-exports it wholesale as the public surface.
import { LID_CLICK_RAIL_BAND_BELOW_WALL_TOP } from '@/features/bin-designer/types/lid';
import type { ScoopConfig, ScoopStyle, ScoopSide } from '@/shared/types/bin';

/** Compartment extent in grid cells, as returned by the compartment-bounds helpers. */
export interface ScoopCompartmentBounds {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

/** Interior grid metrics a scoop is placed against. */
export interface ScoopGridMetrics {
  readonly cols: number;
  readonly rows: number;
  readonly innerW: number;
  readonly innerD: number;
}

/**
 * Where one compartment's scoop sits, resolved for the chosen wall.
 *
 * Everything downstream (BREP ramp, ghost preview, volume estimate) works in
 * "along the wall" / "away from the wall" terms so the orientation is decided
 * exactly once, here.
 */
export interface ScoopPlacement {
  /** Compartment extent along the wall the scoop sits on (mm). */
  readonly span: number;
  /** Compartment extent away from that wall — the axis the run travels (mm). */
  readonly depth: number;
  /** True when the compartment touches the bin's outer wall on this side. */
  readonly isOuter: boolean;
  /** Compartment midpoint along the wall, in bin coordinates (mm). */
  readonly alongCenter: number;
  /** The wall plane the ramp rises from, in bin coordinates (mm). */
  readonly edge: number;
  /** Degrees about +Z that map a front-facing ramp onto this side. */
  readonly rotationDeg: number;
  /** True when the run travels along Y (front/back), false when along X. */
  readonly runsAlongY: boolean;
  /** +1 when the run travels toward increasing coordinate, -1 otherwise. */
  readonly runSign: 1 | -1;
}

const SCOOP_SIDES: readonly ScoopSide[] = ['front', 'back', 'left', 'right'];

/**
 * Normalize a scoop config to a concrete side.
 *
 * Legacy designs carry no `side` and were all front-scooped. The server passes
 * `scoop` through without deep validation, so an unknown value can reach here
 * from a corrupt or crafted payload; it falls back to 'front' rather than
 * dropping out of `resolveScoopPlacement`'s switch as undefined.
 */
export function resolveScoopSide(scoop: ScoopConfig): ScoopSide {
  const side = scoop.side;
  return side !== undefined && SCOOP_SIDES.includes(side) ? side : 'front';
}

/**
 * Resolve which wall a compartment's scoop attaches to and how it is oriented.
 *
 * The ramp geometry is authored once facing front (rising toward -Y, running
 * toward +Y) and mapped onto the chosen wall by `rotationDeg` about +Z.
 */
export function resolveScoopPlacement(
  side: ScoopSide,
  bounds: ScoopCompartmentBounds,
  grid: ScoopGridMetrics
): ScoopPlacement {
  const { minCol, maxCol, minRow, maxRow } = bounds;
  const { cols, rows, innerW, innerD } = grid;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const compW = (maxCol - minCol + 1) * cellW;
  const compD = (maxRow - minRow + 1) * cellD;

  const centerX = -innerW / 2 + (minCol + (maxCol - minCol + 1) / 2) * cellW;
  const centerY = -innerD / 2 + (minRow + (maxRow - minRow + 1) / 2) * cellD;

  switch (side) {
    case 'front':
      return {
        span: compW,
        depth: compD,
        isOuter: minRow === 0,
        alongCenter: centerX,
        edge: -innerD / 2 + minRow * cellD,
        rotationDeg: 0,
        runsAlongY: true,
        runSign: 1,
      };
    case 'back':
      return {
        span: compW,
        depth: compD,
        isOuter: maxRow === rows - 1,
        alongCenter: centerX,
        edge: -innerD / 2 + (maxRow + 1) * cellD,
        rotationDeg: 180,
        runsAlongY: true,
        runSign: -1,
      };
    case 'left':
      return {
        span: compD,
        depth: compW,
        isOuter: minCol === 0,
        alongCenter: centerY,
        edge: -innerW / 2 + minCol * cellW,
        rotationDeg: -90,
        runsAlongY: false,
        runSign: 1,
      };
    case 'right':
      return {
        span: compD,
        depth: compW,
        isOuter: maxCol === cols - 1,
        alongCenter: centerY,
        edge: -innerW / 2 + (maxCol + 1) * cellW,
        rotationDeg: 90,
        runsAlongY: false,
        runSign: -1,
      };
  }
}

/**
 * Ceiling (mm) an AUTO scoop's rise is held to, so it stays out of the band a
 * seated lid's click rail drops into.
 *
 * A scoop against an outer wall does not need the wall top: `lipOffset` is what
 * makes its exit flush with the lip's inner face, and below `wallHeight` the
 * ramp builder carries a vertical chute at that offset from the ramp's top up
 * to the lip base. A ramp that reaches the top instead fills the band with its
 * own arc — 12.8mm of material inboard at the rail's lowest point on a 2x4 —
 * and the rail has to be dropped for it. The thin chute costs 0.07mm against a
 * 0.64mm baseline, so leaving that in the band is free.
 *
 * Auto only. A radius the user typed is honoured as typed, and
 * `checkLidCompatibility` warns when that choice reaches the band.
 */
export function autoScoopCeiling(isOuter: boolean, hasLip: boolean, wallHeight: number): number {
  if (!isOuter || !hasLip) return Infinity;
  // Floored at 1mm: `resolveScoopProfile` drops anything below that, and a bin
  // barely taller than the band would otherwise resolve to a negative rise.
  return Math.max(1, wallHeight - LID_CLICK_RAIL_BAND_BELOW_WALL_TOP);
}

/**
 * Heights a scoop profile clamps against, measured from the interior floor top
 * rather than the box bottom. The ramp stands on that floor: sized against the
 * box-bottom heights its lower `floorThickness` is buried in the floor and the
 * arc meets the floor at an angle instead of tangentially. Every consumer of
 * `resolveScoopProfile` (builder, keep-outs, ghost, readouts, lid check) goes
 * through this so they agree on the same ramp.
 */
export function scoopFrameHeights(
  wallHeight: number,
  interiorHeight: number,
  floorThickness: number
): { readonly wallHeight: number; readonly interiorHeight: number } {
  return {
    wallHeight: Math.max(0, wallHeight - floorThickness),
    interiorHeight: Math.max(0, interiorHeight - floorThickness),
  };
}

/** A scoop resolved to concrete geometry: run along the floor, rise up the wall, and profile shape. */
export interface ResolvedScoopProfile {
  /** Length along the compartment floor in mm. */
  readonly run: number;
  /** Rise up the scoop's wall in mm. */
  readonly height: number;
  /** Profile shape. */
  readonly style: ScoopStyle;
}

/**
 * Resolve a scoop config into a concrete run/height profile for a compartment.
 *
 * Auto mode: proportional (run === height), sized from
 * min(smallerDim/3, max(15, wallHeight*0.5), depth/3) and capped at
 * `scoop.autoMaxHeight` (default MAX_SCOOP_RADIUS). Against an outer wall of a
 * lipped bin it is additionally held out of the click rail's band — see
 * {@link autoScoopCeiling}. Both axes are then clamped symmetrically so the
 * auto ramp stays a quarter shape.
 *
 * Legacy custom (numeric `radius`, no `run`): symmetric quarter shape clamped to
 * min(radius, maxHeight, maxRun) — preserves the pre-two-variable geometry byte
 * for byte.
 *
 * Two-variable custom (numeric `radius` + `run`): height and run clamp
 * independently — height to the interior/wall height, run to the compartment
 * depth — enabling steep or shallow profiles.
 *
 * @param scoop - Scoop config (radius/run/style/autoMaxHeight)
 * @param span - Compartment extent along the scoop's wall in mm
 * @param depth - Compartment extent away from that wall in mm (the run axis)
 * @param isOuter - Whether this compartment touches the bin's outer wall on this side
 * @param hasLip - Whether the bin has a stacking lip
 * @param wallHeight - Full wall height in mm
 * @param interiorHeight - Interior height in mm (wallHeight - lip taper)
 * @param lipOffset - Lip offset in mm (for outer-wall scoops with lip)
 * @returns Resolved profile, or null if the scoop is degenerate (< 1mm on either axis)
 */
export function resolveScoopProfile(
  scoop: ScoopConfig,
  span: number,
  depth: number,
  isOuter: boolean,
  hasLip: boolean,
  wallHeight: number,
  interiorHeight: number,
  lipOffset: number
): ResolvedScoopProfile | null {
  const style: ScoopStyle = scoop.style ?? 'curved';

  // Outer-wall scoops extend to wallHeight (lip base); interior ones to
  // interiorHeight. Run can't exceed the compartment depth (minus a hair and
  // any lip offset).
  const maxHeight = isOuter ? wallHeight : interiorHeight;
  const maxRun = depth - 0.5 - lipOffset;

  let height: number;
  let run: number;

  if (scoop.radius === 'auto') {
    const minDim = Math.min(span, depth);
    // Three-factor balance: curvature, usability, volume
    //  - minDim/3: radius proportional to compartment size (curvature)
    //  - max(15, wallHeight*0.5): height-aware cap for tall bins (usability)
    //  - depth/3: preserve ≥2/3 of depth for storage (volume)
    let r = Math.min(minDim / 3, Math.max(15, wallHeight * 0.5), depth / 3);

    // The auto height ceiling is user-tunable (default MAX_SCOOP_RADIUS). Then
    // clamp both axes together so the auto ramp stays a symmetric quarter shape.
    const autoCap = scoop.autoMaxHeight ?? DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS;
    r = Math.min(r, autoCap, maxHeight, autoScoopCeiling(isOuter, hasLip, wallHeight), maxRun);
    height = r;
    run = r;
  } else if (scoop.run === undefined) {
    // Legacy single-value radius: symmetric quarter shape.
    const r = Math.min(scoop.radius, maxHeight, maxRun);
    height = r;
    run = r;
  } else {
    // Two-variable custom: independent clamps enable steep/shallow profiles.
    height = Math.min(scoop.radius, maxHeight);
    run = Math.min(scoop.run, maxRun);
  }

  if (height < 1 || run < 1) return null;
  return { run, height, style };
}

/**
 * Compute lip offset for a scoop.
 *
 * When a stacking lip is present on a scoop against an outer wall, offset the
 * scoop inward so its top edge meets the lip's protruding inner face. This lets
 * items slide up the scoop and past the lip without catching.
 *
 * The lip extends LIP_TAPER_WIDTH inward from the outer edge. The wall only
 * accounts for wallThickness, leaving (LIP_TAPER_WIDTH - wallThickness) of
 * overhang past the inner wall surface.
 *
 * @param hasLip - Whether the bin has a stacking lip
 * @param isOuter - Whether this compartment touches the outer wall on the scoop's side
 * @param lipTaperWidth - Total lip taper width in mm (LIP_SMALL_TAPER + LIP_BIG_TAPER)
 * @param wallThickness - Wall thickness in mm
 * @returns Lip offset in mm
 */
export function computeLipOffset(
  hasLip: boolean,
  isOuter: boolean,
  lipTaperWidth: number,
  wallThickness: number
): number {
  return hasLip && isOuter ? Math.max(0, lipTaperWidth - wallThickness) : 0;
}

/**
 * Compute interior height for a bin.
 *
 * When a stacking lip is present, the interior height is reduced by the
 * bottom lip taper (LIP_SMALL_TAPER). This is the maximum height for
 * interior-row scoops.
 *
 * @param wallHeight - Full wall height in mm
 * @param hasLip - Whether the bin has a stacking lip
 * @param lipSmallTaper - Bottom lip taper in mm
 * @returns Interior height in mm
 */
export function computeInteriorHeight(
  wallHeight: number,
  hasLip: boolean,
  lipSmallTaper: number
): number {
  return hasLip ? wallHeight - lipSmallTaper : wallHeight;
}
