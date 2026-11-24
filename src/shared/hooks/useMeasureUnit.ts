import { useCallback } from 'react';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { formatLength } from '@/shared/utils/lengthUnit';
import type { LengthUnit } from '@/shared/utils/lengthUnit';

const SYMBOL_KEYS = {
  mm: 'units.symbol.mm',
  cm: 'units.symbol.cm',
  in: 'units.symbol.in',
} as const satisfies Record<LengthUnit, string>;

interface MeasureUnit {
  readonly unit: LengthUnit;
  /** The unit's symbol in the user's language. */
  readonly symbol: string;
  /** A length in mm, as a number in the unit with no symbol. */
  readonly format: (mm: number) => string;
  /** A field label with the symbol after it: "Drawer height (cm)". */
  readonly withUnit: (label: string) => string;
}

/** The unit the user measures drawer and baseplate sizes in. */
export function useMeasureUnit(): MeasureUnit {
  const unit = useSettingsStore((state) => state.settings.measureUnit);
  const t = useTranslation();
  const symbol = t(SYMBOL_KEYS[unit]);
  const format = useCallback((mm: number) => formatLength(mm, unit), [unit]);
  const withUnit = (label: string): string =>
    t('common.labelWithUnit', { label: label, unit: symbol });
  return { unit, symbol, format, withUnit };
}
