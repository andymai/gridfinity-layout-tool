/**
 * Dovetail connector geometry, shared between the generation worker (which cuts
 * the tongues/grooves and builds the standalone dovetail key) and the baseplate
 * feature (split-planner bed budget, print-guide bbox, seated-key preview).
 *
 * Lives in `shared/` because the enforced module-boundary rule forbids the
 * baseplate feature from importing the generation worker's constants directly —
 * this is the single source of truth so the two sides can't drift.
 *
 * The dovetail is a trapezoidal prism, narrow at the wall (BASE_HALF) and wider
 * at the protruding tip (TIP_HALF), reaching PROTRUSION past the wall. The
 * dovetail key (`connectorStyle: 'dovetailKey'`) is two of these mirrored across
 * the waist into one part hammered into the seam.
 */

/** How far the tongue protrudes horizontally from the wall face (mm). */
export const TONGUE_PROTRUSION = 1.5;

/** Half-width at the wall face — narrow end of the dovetail (mm). */
export const TONGUE_BASE_HALF = 1.0;

/** Half-width at the protruding tip — wide end of the dovetail (mm). */
export const TONGUE_TIP_HALF = 1.3;

/** Per-side groove clearance for the slip-fit integral dovetail (mm). */
export const TONGUE_CLEARANCE = 0.15;

/**
 * Per-side groove clearance for the hammered-in dovetail key (mm). Tighter than
 * the slip-fit dovetail so the key holds vertically by friction. 0.075 mm/side
 * lands at the snug "finger-snap" end of FDM dovetail fits for PLA/PETG — and
 * FDM pockets shrink, so the realized fit is tighter still. Drop toward 0.05 for
 * a harder press; the dominant fit factor is first-layer elephant-foot squish,
 * so see the print guide's connector-key tuning notes before changing this.
 */
export const DOVETAIL_KEY_CLEARANCE = 0.075;
