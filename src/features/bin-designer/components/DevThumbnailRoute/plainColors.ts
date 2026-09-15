import type { BinParams } from '@/features/bin-designer/types/binParams';

/**
 * Render a gallery example the way the designer shows a user's own bin: with
 * `featureColors` off, the preview paints every zone from the single
 * `previewColor` (the app default unless the viewer changed it), so a
 * marketing capture matches the app instead of the gallery palette.
 */
export function disableFeatureColors(params: Partial<BinParams>): Partial<BinParams> {
  const featureColors = params.featureColors;
  if (!featureColors || !featureColors.enabled) return params;
  return { ...params, featureColors: { ...featureColors, enabled: false } };
}
