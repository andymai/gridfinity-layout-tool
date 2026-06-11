/**
 * Pure math helpers for slotted bin calculations.
 *
 * Shared between bin-designer (preview/UI) and generation (BREP).
 * No dependencies on brepjs or Three.js.
 */

import { GRIDFINITY } from '@/shared/constants/bin';

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
  const tabDepth = Math.max(MIN_TAB_ENGAGEMENT, slotDepth - clearance - DIVIDER_LENGTH_CLEARANCE);
  return innerDim + 2 * tabDepth;
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
