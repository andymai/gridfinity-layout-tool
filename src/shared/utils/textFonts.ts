/**
 * Which font faces a design actually references.
 *
 * Only three faces load at worker init; the rest arrive on demand, so
 * something has to answer "which does this design need" before geometry is
 * built. The same answer drives the designer's ghost overlay, which has its own
 * font registry to fill on the main thread.
 *
 * Over-reporting is safe (an unused face costs one cached fetch); under-
 * reporting is not, because `buildTextSolid` is synchronous and silently
 * renders nothing when its family is missing.
 */

import type { BinParams, TextFontFamily, TextStyleOverride } from '@/shared/types/bin';

export function collectTextFontFamilies(params: BinParams): Set<TextFontFamily> {
  const families = new Set<TextFontFamily>([params.textDefaults.font]);
  const add = (style: TextStyleOverride | undefined): void => {
    if (style?.font) families.add(style.font);
  };

  add(params.surfaceText?.style);
  add(params.surfaceText?.lidStyle);
  for (const style of Object.values(params.surfaceText?.wallStyles ?? {})) add(style);
  add(params.label.textStyle);
  for (const cutout of params.cutouts ?? []) add(cutout.textStyle);

  // Through-cut swaps to the stencil whatever the pick, and the swap is decided
  // per style deep inside the builders. Adding it unconditionally is cheaper
  // than reproducing that decision here, and it is an eager face anyway.
  families.add('allerta-stencil');
  return families;
}
