import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';

const SYMBOL_KEYS = {
  mm: 'units.symbol.mm',
  cm: 'units.symbol.cm',
  in: 'units.symbol.in',
} as const satisfies Record<LengthUnit, string>;

/** The unit the user types drawer and baseplate sizes in, with its symbol in the user's language. */
export function useMeasureUnit(): { readonly unit: LengthUnit; readonly symbol: string } {
  const unit = useSettingsStore((state) => state.settings.measureUnit);
  const t = useTranslation();
  return { unit, symbol: t(SYMBOL_KEYS[unit]) };
}
