export type LengthUnit = 'mm' | 'cm' | 'in';

export const LENGTH_UNITS: readonly LengthUnit[] = ['mm', 'cm', 'in'];

const MM_PER_UNIT: Readonly<Record<LengthUnit, number>> = { mm: 1, cm: 10, in: 25.4 };

const DEFAULT_DECIMALS: Readonly<Record<LengthUnit, number>> = { mm: 2, cm: 2, in: 3 };

export function isLengthUnit(value: unknown): value is LengthUnit {
  return value === 'mm' || value === 'cm' || value === 'in';
}

export function toMm(value: number, unit: LengthUnit): number {
  return value * MM_PER_UNIT[unit];
}

export function fromMm(mm: number, unit: LengthUnit): number {
  return mm / MM_PER_UNIT[unit];
}

/** A length in `unit`, rounded to `decimals` with no trailing zeros and no unit suffix. */
export function formatLength(
  mm: number,
  unit: LengthUnit,
  decimals: number = DEFAULT_DECIMALS[unit]
): string {
  const factor = 10 ** decimals;
  return String(Math.round(fromMm(mm, unit) * factor) / factor);
}
