/**
 * Shared scoop calculation utilities.
 *
 * Provides functions for resolving scoop radius and computing lip offset.
 * Used by binGenerator.ts, GhostScoops.tsx, and printEstimates.ts to ensure
 * consistent scoop geometry across generation, preview, and estimates.
 */

/**
 * Resolve scoop radius for a compartment.
 *
 * Auto mode: min(smallerDim/3, 15mm), clamped to fit compartment and height.
 * Manual mode: clamped to fit compartment and height.
 *
 * For front-row scoops with a stacking lip, auto radius is increased to reach
 * wallHeight so the scoop top meets the lip's inner face.
 *
 * @param scoopRadius - Scoop config radius ('auto' or manual mm)
 * @param compW - Compartment width in mm
 * @param compD - Compartment depth in mm
 * @param isMinRow - Whether this compartment is in the front row (row 0)
 * @param hasLip - Whether the bin has a stacking lip
 * @param wallHeight - Full wall height in mm
 * @param interiorHeight - Interior height in mm (wallHeight - lip taper)
 * @param lipOffset - Lip offset in mm (for front-row scoops with lip)
 * @returns Resolved radius in mm, or 0 if radius < 1
 */
export function resolveScoopRadius(
  scoopRadius: number | 'auto',
  compW: number,
  compD: number,
  isMinRow: boolean,
  hasLip: boolean,
  wallHeight: number,
  interiorHeight: number,
  lipOffset: number
): number {
  const minDim = Math.min(compW, compD);
  let radius: number;
  if (scoopRadius === 'auto') {
    radius = Math.min(minDim / 3, 15);
  } else {
    radius = scoopRadius;
  }

  // For front-row scoops with lip, auto radius must reach wallHeight
  // so the scoop top meets the lip's inner face.
  if (scoopRadius === 'auto' && hasLip && isMinRow) {
    radius = Math.max(radius, wallHeight);
  }

  // Clamp: radius can't exceed compartment depth (minus offset) or wall height.
  // Front-row scoops extend to wallHeight (lip base); interior rows to interiorHeight.
  const maxHeight = isMinRow ? wallHeight : interiorHeight;
  radius = Math.min(radius, compD - 0.5 - lipOffset, maxHeight);

  return radius < 1 ? 0 : radius;
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
