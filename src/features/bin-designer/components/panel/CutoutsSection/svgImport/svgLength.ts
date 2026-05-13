/**
 * Parses SVG length attributes (width, height) with optional physical units
 * and converts to millimeters. Used to compute the user-units → mm scale
 * factor for the imported geometry.
 *
 * Only physical/absolute units are recognized (mm, cm, in, pt, pc, Q).
 * Unitless values, percentages, and px are intentionally returned as `null`
 * so the caller falls back to 1:1 user-unit semantics — historically how
 * SVGs without explicit physical sizing have been imported.
 */

type PhysicalUnit = 'mm' | 'cm' | 'in' | 'pt' | 'pc' | 'q';

const PHYSICAL_UNIT_TO_MM: Record<PhysicalUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
  q: 0.25,
};

const LENGTH_RE = /^([-+]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Z%]*)$/;

function isPhysicalUnit(unit: string): unit is PhysicalUnit {
  return unit in PHYSICAL_UNIT_TO_MM;
}

/**
 * Parse an SVG length attribute and return its value in millimeters.
 *
 * Returns `null` if:
 * - the input is null/empty/unparseable,
 * - the unit is `%` (relative — can't resolve without a parent length),
 * - the unit is `px` or absent (caller should keep the user-unit value as-is).
 *
 * @example parseSvgLengthMm("100mm") → 100
 * @example parseSvgLengthMm("2in")   → 50.8
 * @example parseSvgLengthMm("200")   → null
 */
export function parseSvgLengthMm(str: string | null | undefined): number | null {
  if (!str) return null;
  const match = str.trim().match(LENGTH_RE);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2].toLowerCase();
  if (!isPhysicalUnit(unit)) return null;
  return value * PHYSICAL_UNIT_TO_MM[unit];
}
