import type { BinParams } from '@/features/bin-designer/types/binParams';

/**
 * Restyle a gallery example's body color for a marketing capture.
 *
 * The colored heroes run with `featureColors.enabled`, so the preview ignores
 * the single-color `previewColor` and paints every zone from the config. Zones
 * the example never gave an accent were defaulted to the body color, so they
 * have to follow it here or a recolored body leaves its own base and dividers
 * stranded on the old one.
 *
 * Zones carrying a real accent keep it: matching on the previous body color is
 * what separates "defaulted" from "chosen".
 */
export function recolorBody(params: Partial<BinParams>, body: string): Partial<BinParams> {
  const featureColors = params.featureColors;
  if (!featureColors) return params;

  const previous = featureColors.body;
  const swap = (hex: string): string => (hex === previous ? body : hex);

  return {
    ...params,
    featureColors: {
      ...featureColors,
      body,
      base: swap(featureColors.base),
      labelTab: swap(featureColors.labelTab),
      scoop: swap(featureColors.scoop),
      dividers: swap(featureColors.dividers),
      text: swap(featureColors.text),
      lid: swap(featureColors.lid),
      lip: {
        ...featureColors.lip,
        cells: Object.fromEntries(
          Object.entries(featureColors.lip.cells).map(([id, hex]) => [id, swap(hex)])
        ),
      },
    },
  };
}
