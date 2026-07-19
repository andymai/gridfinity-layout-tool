/**
 * Pure math helpers for slotted bin calculations.
 *
 * Shared between bin-designer (preview/UI) and generation (BREP).
 * No dependencies on brepjs or Three.js.
 */

import { GRIDFINITY } from '@/shared/constants/bin';
import type { CrossDividerStyle, SlotConfig } from '@/shared/types/bin';

const LIP_SMALL_TAPER = GRIDFINITY.LIP_SMALL_TAPER;

/**
 * Extra per-side clearance subtracted from divider length (not from slot width).
 * Divider length and slot width have different tolerance needs:
 * - Slot width clearance controls side-to-side rattle (tight is fine)
 * - Length clearance prevents bowing when the divider spans the full interior
 *
 * FDM printers typically over-extrude interior dimensions by 0.1–0.3mm,
 * making the divider effectively longer than modeled.
 */
const DIVIDER_LENGTH_CLEARANCE = 0.3;

/**
 * Minimum tab engagement depth per side (mm).
 * Ensures the divider tab always has enough material in the slot
 * to resist lateral forces, even with generous clearance values.
 */
const MIN_TAB_ENGAGEMENT = 0.3;

/**
 * Calculate evenly-distributed slot center positions along a dimension.
 * Returns positions relative to the center of the dimension (0 = center).
 *
 * Dividers are placed to create equal-sized compartments within the
 * effective dimension (inner dimension minus edge insets on each side).
 * N compartments require N-1 dividers spaced at effectiveDim/N intervals.
 *
 * @param innerDim Interior dimension in mm
 * @param pitch Target compartment size in mm (used to determine compartment count)
 * @param edgeInset Inset from each wall edge in mm (e.g. lip overhang)
 * @returns Array of slot center positions (relative to center)
 */
export function calculateSlotPositions(innerDim: number, pitch: number, edgeInset = 0): number[] {
  if (pitch <= 0 || innerDim <= 0) return [];

  const effectiveDim = innerDim - 2 * edgeInset;
  if (effectiveDim <= 0) return [];

  const numCompartments = Math.round(effectiveDim / pitch);
  if (numCompartments < 2) return [];

  const numDividers = numCompartments - 1;
  const spacing = effectiveDim / numCompartments;

  const positions: number[] = [];
  for (let i = 0; i < numDividers; i++) {
    positions.push(-effectiveDim / 2 + (i + 1) * spacing);
  }
  return positions;
}

/**
 * Calculate the effective divider height in mm.
 * When 'auto', matches the bin interior height (below lip taper).
 */
export function calculateDividerHeight(
  config: { height: number | 'auto' },
  wallHeight: number,
  hasLip: boolean
): number {
  if (config.height === 'auto') {
    return hasLip ? wallHeight - LIP_SMALL_TAPER : wallHeight;
  }
  return config.height;
}

/**
 * Minimum interior compartment-divider height in mm. Below this a partial
 * divider becomes a barely-printable sliver, so numeric heights clamp up to it.
 */
export const MIN_COMPARTMENT_DIVIDER_HEIGHT = 2;

/**
 * Resolve the effective interior compartment-divider height in mm.
 *
 * `'auto'`/undefined → the full interior height (the historical full-height
 * divider). A numeric value is clamped to
 * `[MIN_COMPARTMENT_DIVIDER_HEIGHT, interiorHeight]` so dividers stay printable
 * and never poke above the rim.
 */
export function resolveCompartmentDividerHeight(
  dividerHeight: number | 'auto' | undefined,
  interiorHeight: number
): number {
  if (dividerHeight === undefined || dividerHeight === 'auto') return interiorHeight;
  return Math.min(interiorHeight, Math.max(MIN_COMPARTMENT_DIVIDER_HEIGHT, dividerHeight));
}

/**
 * Calculate the divider length for a given axis.
 *
 * The divider spans the interior dimension plus tab engagement on each side.
 * Tab engagement = slotDepth − widthClearance − lengthClearance, clamped to
 * a minimum of MIN_TAB_ENGAGEMENT so the divider always locks into the slots.
 *
 * @param innerDim Interior dimension in mm (wall-to-wall)
 * @param slotDepth How deep the slot is cut into the wall (mm)
 * @param clearance Fit tolerance for slot width (mm). Both this clearance and
 *   DIVIDER_LENGTH_CLEARANCE are subtracted when computing tab engagement depth.
 */
export function calculateDividerLength(
  innerDim: number,
  slotDepth: number,
  clearance: number
): number {
  return innerDim + 2 * tabEngagement(slotDepth, clearance);
}

/** Tab engagement depth for one divider end given the receiving slot depth. */
export function tabEngagement(slotDepth: number, clearance: number): number {
  return Math.max(MIN_TAB_ENGAGEMENT, slotDepth - clearance - DIVIDER_LENGTH_CLEARANCE);
}

/**
 * Receptacle groove depth per divider face, as a fraction of divider
 * thickness. Grooves are cut into BOTH faces at each position, so this
 * ratio leaves a 40% web (1 − 2 × 0.3) between opposing grooves.
 */
export const RECEPTACLE_DEPTH_RATIO = 0.3;

/**
 * Minimum divider thickness for functional face receptacles (mm).
 * Below this the per-face groove (thickness × RECEPTACLE_DEPTH_RATIO)
 * is too shallow to register a short divider, and the remaining web
 * becomes fragile.
 */
export const MIN_DIVIDER_FOR_RECEPTACLES = 1.2;

/** Per-face receptacle groove depth for a given divider thickness. */
export function getReceptacleDepth(dividerThickness: number): number {
  return dividerThickness * RECEPTACLE_DEPTH_RATIO;
}

/**
 * Resolve the effective cross-divider mode for a slot configuration.
 *
 * Returns 'lap' unless both axes are enabled, 'insert' was requested, and
 * the divider is thick enough to carry face receptacles — geometry and UI
 * share this so a too-thin divider degrades identically everywhere.
 */
export function resolveCrossDividerMode(
  slotConfig: SlotConfig,
  dividerThickness: number
): { style: CrossDividerStyle; longAxis: 'x' | 'y' } {
  // Clamp persisted values: imported configs merge unvalidated, and a bad
  // longAxis would otherwise be used as an index into slotConfig.
  const longAxis = slotConfig.longAxis === 'x' ? 'x' : 'y';
  const bothAxes = slotConfig.x.enabled && slotConfig.y.enabled;
  const style: CrossDividerStyle =
    bothAxes &&
    (slotConfig.crossStyle ?? 'lap') === 'insert' &&
    dividerThickness >= MIN_DIVIDER_FOR_RECEPTACLES
      ? 'insert'
      : 'lap';
  return { style, longAxis };
}

/**
 * Compartment spans along the short-divider direction, measured face-to-face.
 *
 * `longPositions` are the full-length divider centers (relative to the
 * interior center, as returned by calculateSlotPositions). Interior spans
 * separate two dividers; edge spans run from the bin wall face to the
 * nearest divider face, so they differ by thickness/2 plus any edge inset
 * baked into the positions.
 *
 * Returns null spans when that compartment kind doesn't exist
 * (interior needs ≥2 dividers, edge needs ≥1).
 */
export function calculateShortDividerSpans(
  longPositions: readonly number[],
  innerDim: number,
  dividerThickness: number
): { interior: number | null; edge: number | null } {
  if (longPositions.length === 0) return { interior: null, edge: null };
  const sorted = [...longPositions].sort((a, b) => a - b);
  // calculateSlotPositions spaces dividers uniformly, but take the minimum
  // gap so a single interior piece stays safe in every compartment even if
  // positions ever become non-uniform.
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  }
  const interior = sorted.length >= 2 ? minGap - dividerThickness : null;
  const edge = sorted[0] + innerDim / 2 - dividerThickness / 2;
  return { interior, edge };
}

/**
 * Short divider piece lengths from compartment spans.
 *
 * Interior pieces engage a face receptacle on both ends. Edge pieces
 * engage a wall slot on one end and a receptacle on the other, but use
 * the SHALLOWER of the two tab depths on both ends: a symmetric piece
 * can be installed in either orientation, whereas a longer wall tab
 * would bottom out in the receptacle groove when flipped and hold the
 * piece proud of the wall.
 */
export function calculateShortDividerLengths(
  spans: { interior: number | null; edge: number | null },
  wallSlotDepth: number,
  receptacleDepth: number,
  clearance: number
): { interior: number | null; edge: number | null } {
  const wallTab = tabEngagement(wallSlotDepth, clearance);
  const receptacleTab = tabEngagement(receptacleDepth, clearance);
  const edgeTab = Math.min(wallTab, receptacleTab);
  return {
    interior: spans.interior !== null ? spans.interior + 2 * receptacleTab : null,
    edge: spans.edge !== null ? spans.edge + 2 * edgeTab : null,
  };
}

/**
 * Minimum wall thickness required for functional slotted bins (mm).
 * Below this, the wall is too thin to cut a slot without cutting through.
 * Exported for UI validation (e.g. disabling slotted style for thin walls).
 */
export const MIN_WALL_FOR_SLOTS = 0.8;

/**
 * Compute effective slot dimensions from divider configuration.
 *
 * - Slot opening (width) = divider thickness + 2 × fit tolerance
 * - Slot cut depth = 50% of wall thickness, nominally clamped to [0.5, 1.5]mm,
 *   then capped at 80% of wall thickness. For thin walls (< ~0.63mm) the 80%
 *   cap produces values below 0.5mm to avoid cutting through the wall.
 */
export function getEffectiveSlotDimensions(
  wallThickness: number,
  dividerThickness: number,
  dividerClearance: number
): { slotWidth: number; slotDepth: number } {
  const slotWidth = dividerThickness + 2 * dividerClearance;
  // Target 50% of wall, clamp to [0.5, 1.5]mm, but cap at 80% of wall
  // so the slot never cuts through to the outside surface.
  const rawDepth = Math.min(1.5, Math.max(0.5, wallThickness * 0.5));
  const slotDepth = Math.min(rawDepth, wallThickness * 0.8);
  return { slotWidth, slotDepth };
}
