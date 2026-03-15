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

/** Convert millimeters to height units (rounds down to nearest integer). */
export function mmToHeightUnits(value: Mm, unitMm: Mm): HeightUnits {
  return Math.floor(value / unitMm) as HeightUnits;
}
