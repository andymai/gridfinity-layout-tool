/**
 * Branded Unit Types -- Compile-time unit safety.
 *
 * Prevents mixing millimeters, grid units, and height units in calculations.
 * Matches the existing branded ID pattern (BinId, LayerId, etc.) from ids.ts.
 *
 * Usage:
 *   const w: GridUnits = gridUnits(2);
 *   const mmValue: Mm = gridUnitsToMm(w, mm(42));
 *   // Compile error: const bad: Mm = w;
 */

// === Branded Unit Types ===

/** Millimeters -- physical distance. */
export type Mm = number & { readonly __brand: 'Mm' };

/** Grid units -- drawer/bin coordinate system (default 42mm per unit). */
export type GridUnits = number & { readonly __brand: 'GridUnits' };

/** Height units -- vertical bin sizing (default 7mm per unit). */
export type HeightUnits = number & { readonly __brand: 'HeightUnits' };

// === Constructors ===
// Brand raw numbers at system boundaries (deserialization, user input, constants).

/** Brand a raw number as Mm. */
export const mm = (n: number): Mm => n as Mm;

/** Brand a raw number as GridUnits. */
export const gridUnits = (n: number): GridUnits => n as GridUnits;

/** Brand a raw number as HeightUnits. */
export const heightUnits = (n: number): HeightUnits => n as HeightUnits;

/**
 * Smallest height-unit increment. Heights are free fractional (e.g. a 30.6mm
 * target at a 7mm unit is 4.37u), but values are snapped to this step so the
 * stored number and its mm readout stay free of floating-point dust.
 */
export const HEIGHT_UNIT_STEP = 0.01;

/**
 * Round a height-unit value to {@link HEIGHT_UNIT_STEP}. Divides/multiplies by
 * the integer inverse (100) rather than the 0.01 step so the result is a clean
 * decimal (4.37, not 4.3700000000000045). The tiny pre-round bias nudges exact
 * half-steps up despite binary error (1.005 * 100 = 100.4999… would else floor
 * to 1.00 instead of snapping to 1.01).
 */
const HEIGHT_UNIT_STEP_INVERSE = 1 / HEIGHT_UNIT_STEP;
export const roundHeightUnits = (n: number): HeightUnits =>
  (Math.round(n * HEIGHT_UNIT_STEP_INVERSE + 1e-6) / HEIGHT_UNIT_STEP_INVERSE) as HeightUnits;

// === Converters ===
// Type-safe unit transformations. Each conversion requires the appropriate scale factor.

/** Convert grid units to millimeters. */
export function gridUnitsToMm(value: GridUnits, unitMm: Mm): Mm {
  return (value * unitMm) as Mm;
}

/** Convert height units to millimeters. */
export function heightUnitsToMm(value: HeightUnits, unitMm: Mm): Mm {
  return (value * unitMm) as Mm;
}

/** Convert millimeters to grid units (rounds down to nearest integer). */
export function mmToGridUnits(value: Mm, unitMm: Mm): GridUnits {
  return Math.floor(value / unitMm) as GridUnits;
}

/**
 * Convert millimeters to height units, snapped to {@link HEIGHT_UNIT_STEP}.
 * Heights are free fractional, so this rounds to the nearest 0.01u rather than
 * flooring — flooring would silently drop the sub-unit part of an mm target.
 */
export function mmToHeightUnits(value: Mm, unitMm: Mm): HeightUnits {
  return roundHeightUnits(value / unitMm);
}
