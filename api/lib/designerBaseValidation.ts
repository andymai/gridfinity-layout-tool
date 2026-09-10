/** Base and wall validation for shared bin designs: base style, feet, lip, wall cutouts, corner radii. */

import { isNumber, inRange, isBoolean, isObject } from './validationUtils.js';
import { validateTrayBottom } from './designerLidValidation.js';

const VALID_BASE_STYLES = [
  'standard',
  'magnet',
  'screw',
  'magnet_and_screw',
  'weighted',
  'flat',
  // Underside is lid mating geometry instead of a socket.
  'lid',
] as const;

// Mirrors `FOOT_LATTICES` in `src/features/bin-designer/types/base.ts`.
export const VALID_FOOT_LATTICES = ['grid', 'half'] as const;

// Mirrors `LIGHTWEIGHT_MODES` in the same file.
export const VALID_LIGHTWEIGHT_MODES = ['interior', 'underside'] as const;

// Mirrors `LIP_TIP_STYLES` in the same file.
export const VALID_LIP_TIPS = ['sharp', 'round', 'chamfer'] as const;

// Mirrors `FEET_MODES` and `DETACHABLE_PIN_DIAMETERS_MM` in the same file.
export const VALID_FEET_MODES = ['integral', 'detachable'] as const;

export const VALID_PIN_DIAMETERS = [2.6, 2.7, 2.8, 2.9, 3, 3.1, 3.2] as const;

const VALID_WALL_CUTOUT_SHAPES = ['u-shape', 'scoop', 'funnel'] as const;

/**
 * Cross-boundary contract: MUST match `MAX_CUTOUT_CORNER_RADIUS` in
 * `src/shared/utils/wallCutoutPosition.ts`. A cutout's corner radius drives a
 * blend the generator has to build, so an unbounded one is a crafted payload
 * that turns into an unbounded boolean.
 */
export const MAX_CUTOUT_CORNER_RADIUS = 25;

/**
 * Validate the `base` object of a designer payload.
 *
 * Checks that `base` is an object and that it contains a valid `style`, numeric `magnetDiameter` (1–20),
 * numeric `magnetDepth` (0.5–10), numeric `screwDiameter` (1–10), and boolean `stackingLip`.
 *
 * @param base - The value to validate as a designer `base` object (expected keys: `style`, `magnetDiameter`, `magnetDepth`, `screwDiameter`, `stackingLip`, and the optional `spacer` and `tile`).
 * @returns A string describing the first validation error encountered, or `null` if `base` is valid.
 */
export function validateBase(base: unknown): string | null {
  if (!isObject(base)) return 'base must be an object';
  if (!VALID_BASE_STYLES.includes(base.style as (typeof VALID_BASE_STYLES)[number])) {
    return `base.style must be one of: ${VALID_BASE_STYLES.join(', ')}`;
  }
  if (!isNumber(base.magnetDiameter) || !inRange(base.magnetDiameter, 1, 20)) {
    return 'base.magnetDiameter must be 1-20';
  }
  if (!isNumber(base.magnetDepth) || !inRange(base.magnetDepth, 0.5, 10)) {
    return 'base.magnetDepth must be 0.5-10';
  }
  if (!isNumber(base.screwDiameter) || !inRange(base.screwDiameter, 1, 10)) {
    return 'base.screwDiameter must be 1-10';
  }
  if (!isBoolean(base.stackingLip)) return 'base.stackingLip must be boolean';
  // Spacer changes the shell (a floorless riser), so a shared payload has to
  // declare it honestly rather than smuggle a truthy non-boolean past the client.
  if (base.spacer !== undefined && !isBoolean(base.spacer)) {
    return 'base.spacer must be boolean';
  }
  // Same reasoning for the base-only bin: it collapses the wall to zero, which
  // is a different solid entirely, so it must be declared as a real boolean.
  if (base.tile !== undefined && !isBoolean(base.tile)) {
    return 'base.tile must be boolean';
  }
  // Foot lattice per axis: a closed set, so an unknown value is
  // rejected rather than silently falling back to a different set of feet than
  // the publisher previewed — one that may not seat in a baseplate.
  for (const axis of ['footLatticeX', 'footLatticeY'] as const) {
    const value = base[axis];
    if (
      value !== undefined &&
      !VALID_FOOT_LATTICES.includes(value as (typeof VALID_FOOT_LATTICES)[number])
    ) {
      return `base.${axis} must be one of: ${VALID_FOOT_LATTICES.join(', ')}`;
    }
  }
  // Relief direction: a closed set for the same reason the lattice is. The two
  // modes are different solids — one opens the cavity floor, the other leaves it
  // — so an unknown value must be rejected rather than fall back to whichever
  // the publisher did not preview.
  if (
    base.lightweightMode !== undefined &&
    !VALID_LIGHTWEIGHT_MODES.includes(
      base.lightweightMode as (typeof VALID_LIGHTWEIGHT_MODES)[number]
    )
  ) {
    return `base.lightweightMode must be one of: ${VALID_LIGHTWEIGHT_MODES.join(', ')}`;
  }
  // Lip tip: a closed set. Cosmetically small, but an unknown value silently
  // falling back to 'sharp' would publish a bin whose printed peak is not the
  // one the publisher previewed.
  if (
    base.lipTip !== undefined &&
    !VALID_LIP_TIPS.includes(base.lipTip as (typeof VALID_LIP_TIPS)[number])
  ) {
    return `base.lipTip must be one of: ${VALID_LIP_TIPS.join(', ')}`;
  }
  // Feet mode: a closed set, and a consequential one — a detachable-feet bin
  // has no socket under it at all, so an unknown value falling back to
  // 'integral' would publish a different part than the one previewed.
  if (
    base.feet !== undefined &&
    !VALID_FEET_MODES.includes(base.feet as (typeof VALID_FEET_MODES)[number])
  ) {
    return `base.feet must be one of: ${VALID_FEET_MODES.join(', ')}`;
  }
  // The pin diameter is an interference fit against a fixed hole, not a free
  // dimension: values outside the offered pair either fall out or will not go
  // on, so membership is checked rather than a range.
  if (
    base.feetPinDiameter !== undefined &&
    !VALID_PIN_DIAMETERS.includes(base.feetPinDiameter as (typeof VALID_PIN_DIAMETERS)[number])
  ) {
    return `base.feetPinDiameter must be one of: ${VALID_PIN_DIAMETERS.join(', ')}`;
  }
  if (base.trayBottom !== undefined) {
    const trayErr = validateTrayBottom(base.trayBottom);
    if (trayErr) return trayErr;
  }
  return null;
}

/**
 * Validates the walls configuration from the designer payload.
 *
 * @param walls - The value to validate as a walls object
 * @returns `null` if valid; otherwise an error message
 */
export function validateWalls(walls: unknown): string | null {
  if (!isObject(walls)) return 'walls must be an object';
  // enabled is optional for legacy payloads (number-based wall format)
  if (walls.enabled !== undefined && !isBoolean(walls.enabled)) {
    return 'walls.enabled must be boolean';
  }
  if (
    walls.shape !== undefined &&
    !VALID_WALL_CUTOUT_SHAPES.includes(walls.shape as (typeof VALID_WALL_CUTOUT_SHAPES)[number])
  ) {
    return `walls.shape must be one of: ${VALID_WALL_CUTOUT_SHAPES.join(', ')}`;
  }
  // Corner radii: null is the value that means "defer to the level above", so
  // it is accepted alongside a missing field. Anything else has to be a number
  // in range at BOTH levels — the side's override is what the generator reads.
  const cornerErr = validateCornerRadii(walls, 'walls');
  if (cornerErr) return cornerErr;
  // Validate per-side width/depth are in range (0-100%)
  for (const side of ['front', 'back', 'left', 'right', 'interior']) {
    const sideConfig = walls[side];
    if (sideConfig !== undefined && isObject(sideConfig)) {
      if (isNumber(sideConfig.width) && !inRange(sideConfig.width, 0, 100)) {
        return `walls.${side}.width must be 0-100`;
      }
      if (isNumber(sideConfig.depth) && !inRange(sideConfig.depth, 0, 100)) {
        return `walls.${side}.depth must be 0-100`;
      }
      const sideCornerErr = validateCornerRadii(sideConfig, `walls.${side}`);
      if (sideCornerErr) return sideCornerErr;
    }
  }
  return null;
}

/** Bound `cornerRadiusTop` / `cornerRadiusBottom` on a walls or per-side object. */
function validateCornerRadii(cfg: Record<string, unknown>, path: string): string | null {
  for (const key of ['cornerRadiusTop', 'cornerRadiusBottom']) {
    const value = cfg[key];
    if (value === undefined || value === null) continue;
    if (!isNumber(value) || !inRange(value, 0, MAX_CUTOUT_CORNER_RADIUS)) {
      return `${path}.${key} must be 0-${MAX_CUTOUT_CORNER_RADIUS} or null`;
    }
  }
  return null;
}
