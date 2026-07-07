/**
 * Shared scoop calculation utilities.
 *
 * Provides functions for resolving a scoop's two-axis profile (run along the
 * floor + rise up the wall) and computing lip offset. Used by
 * scoopRampBuilder.ts, GhostScoops.tsx, and printEstimates.ts to keep scoop
 * geometry consistent across generation, preview, and estimates.
 */

import { DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import type { ScoopConfig, ScoopStyle } from '@/shared/types/bin';

/** A scoop resolved to concrete geometry: run (Y), rise (Z), and profile shape. */
export interface ResolvedScoopProfile {
  /** Length along the compartment floor in mm. */
  readonly run: number;
  /** Rise up the front wall in mm. */
  readonly height: number;
  /** Profile shape. */
  readonly style: ScoopStyle;
}

/**
 * Resolve a scoop config into a concrete run/height profile for a compartment.
 *
 * Auto mode: proportional (run === height), sized from
 * min(smallerDim/3, max(15, wallHeight*0.5), compD/3) and capped at
 * `scoop.autoMaxHeight` (default MAX_SCOOP_RADIUS). For front-row scoops with a
 * stacking lip the height is raised toward wallHeight so the scoop top meets the
 * lip's inner face. Both axes are then clamped symmetrically so the auto ramp
 * stays a quarter shape.
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
 * @param compW - Compartment width in mm
 * @param compD - Compartment depth in mm
 * @param isMinRow - Whether this compartment is in the front row (row 0)
 * @param hasLip - Whether the bin has a stacking lip
 * @param wallHeight - Full wall height in mm
 * @param interiorHeight - Interior height in mm (wallHeight - lip taper)
 * @param lipOffset - Lip offset in mm (for front-row scoops with lip)
 * @returns Resolved profile, or null if the scoop is degenerate (< 1mm on either axis)
 */
export function resolveScoopProfile(
  scoop: ScoopConfig,
  compW: number,
  compD: number,
  isMinRow: boolean,
  hasLip: boolean,
  wallHeight: number,
  interiorHeight: number,
  lipOffset: number
): ResolvedScoopProfile | null {
  const style: ScoopStyle = scoop.style ?? 'curved';

  // Front-row scoops extend to wallHeight (lip base); interior rows to
  // interiorHeight. Run can't exceed the compartment depth (minus a hair and
  // any lip offset).
  const maxHeight = isMinRow ? wallHeight : interiorHeight;
  const maxRun = compD - 0.5 - lipOffset;

  let height: number;
  let run: number;

  if (scoop.radius === 'auto') {
    const minDim = Math.min(compW, compD);
    // Three-factor balance: curvature, usability, volume
    //  - minDim/3: radius proportional to compartment size (curvature)
    //  - max(15, wallHeight*0.5): height-aware cap for tall bins (usability)
    //  - compD/3: preserve ≥2/3 of depth for storage (volume)
    let r = Math.min(minDim / 3, Math.max(15, wallHeight * 0.5), compD / 3);

    // For front-row scoops with lip, auto radius reaches wallHeight so the
    // scoop top meets the lip's inner face.
    if (hasLip && isMinRow) r = Math.max(r, wallHeight);

    // The auto height ceiling is user-tunable (default MAX_SCOOP_RADIUS). Then
    // clamp both axes together so the auto ramp stays a symmetric quarter shape.
    const autoCap = scoop.autoMaxHeight ?? DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS;
    r = Math.min(r, autoCap, maxHeight, maxRun);
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
 * When a stacking lip is present on a front-row scoop, offset the scoop
 * inward so its top edge meets the lip's protruding inner face. This lets
 * items slide up the scoop and past the lip without catching.
 *
 * The lip extends LIP_TAPER_WIDTH inward from the outer edge. The wall only
 * accounts for wallThickness, leaving (LIP_TAPER_WIDTH - wallThickness) of
 * overhang past the inner wall surface.
 *
 * @param hasLip - Whether the bin has a stacking lip
 * @param isMinRow - Whether this compartment is in the front row (row 0)
 * @param lipTaperWidth - Total lip taper width in mm (LIP_SMALL_TAPER + LIP_BIG_TAPER)
 * @param wallThickness - Wall thickness in mm
 * @returns Lip offset in mm
 */
export function computeLipOffset(
  hasLip: boolean,
  isMinRow: boolean,
  lipTaperWidth: number,
  wallThickness: number
): number {
  return hasLip && isMinRow ? Math.max(0, lipTaperWidth - wallThickness) : 0;
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
