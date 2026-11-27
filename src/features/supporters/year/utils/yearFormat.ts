import type { LengthUnit } from '@/shared/utils/lengthUnit';

const MM2_PER_M2 = 1_000_000;
const MM2_PER_FT2 = 92_903.04;
/** A 35 cm square pizza box: a size a reader can picture in any country. */
const PIZZA_BOX_MM2 = 350 * 350;

function number(locale: string, value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export function formatCount(locale: string, value: number): string {
  return number(locale, value);
}

/** Square metres, or square feet for a user who measures in inches. */
export function formatArea(locale: string, mm2: number, unit: LengthUnit): string {
  if (unit === 'in') return `${number(locale, mm2 / MM2_PER_FT2, 1)} ft²`;
  return `${number(locale, mm2 / MM2_PER_M2, 2)} m²`;
}

const LENGTH_DIGITS: Readonly<Record<LengthUnit, number>> = { mm: 0, cm: 1, in: 1 };
const MM_PER: Readonly<Record<LengthUnit, number>> = { mm: 1, cm: 10, in: 25.4 };

export function formatSize(
  locale: string,
  widthMm: number,
  depthMm: number,
  unit: LengthUnit
): string {
  const digits = LENGTH_DIGITS[unit];
  const w = number(locale, widthMm / MM_PER[unit], digits);
  const d = number(locale, depthMm / MM_PER[unit], digits);
  return `${w} × ${d} ${unit}`;
}

export function formatFootprint(locale: string, width: number, depth: number): string {
  return `${number(locale, width, 1)}×${number(locale, depth, 1)}`;
}

export function formatWeight(locale: string, grams: number): string {
  if (grams < 1000) return `${number(locale, grams)} g`;
  return `${number(locale, grams / 1000, 1)} kg`;
}

export function formatPercent(locale: string, ratio: number): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    ratio
  );
}

function unitPart(locale: string, value: number, unit: 'hour' | 'minute'): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
  }).format(value);
}

/** "9 hr 40 min" style, in the locale's own unit words. */
export function formatDuration(locale: string, minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return unitPart(locale, rest, 'minute');
  if (rest === 0) return unitPart(locale, hours, 'hour');
  return `${unitPart(locale, hours, 'hour')} ${unitPart(locale, rest, 'minute')}`;
}

/** A month name on its own, which Intl gives in the nominative form. */
export function monthName(locale: string, year: number, month: number): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month, 15));
}

export function pizzaBoxes(mm2: number): number {
  return Math.max(1, Math.round(mm2 / PIZZA_BOX_MM2));
}

/** Spools are sold by the kilogram. */
export function spools(grams: number): number {
  return Math.max(1, Math.round(grams / 1000));
}

export function printerHours(minutes: number): number {
  return Math.max(1, Math.round(minutes / 60));
}
