import type { TextMode } from '../types';

/**
 * A picker's modes, with `flat` appended while the design prints in more than
 * one colour. A design that already holds `flat` keeps the option after
 * multi-colour is turned off, so the picker still shows what is selected.
 */
export function textModeChoices(
  base: readonly TextMode[],
  multiColor: boolean,
  current: TextMode
): readonly TextMode[] {
  if (base.includes('flat')) return base;
  return multiColor || current === 'flat' ? [...base, 'flat'] : base;
}
