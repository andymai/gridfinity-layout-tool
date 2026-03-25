/**
 * Feature color types for multi-color bin design.
 *
 * Each color zone stores a hex color string directly.
 * No palette indirection — users pick colors per zone.
 */

import { FeatureTag } from '@/shared/types/generation';

/** High-level color zone grouping multiple FeatureTags */
export type ColorZone = 'body' | 'lip' | 'labelTab';

/** Per-zone hex color assignment */
export interface FeatureColorConfig {
  /** Body shell color (hex, e.g. '#3b82f6') */
  readonly body: string;
  /** Stacking lip color */
  readonly lip: string;
  /** Label tab color */
  readonly labelTab: string;
}

/**
 * Maps a FeatureTag to its high-level ColorZone.
 *
 * LIP → 'lip', LABEL_TAB → 'labelTab', everything else → 'body'.
 */
export function featureTagToColorZone(tag: number): ColorZone {
  switch (tag) {
    case FeatureTag.LIP:
      return 'lip';
    case FeatureTag.LABEL_TAB:
      return 'labelTab';
    default:
      return 'body';
  }
}

/**
 * Returns true when all *active* color zones use the same color
 * (single-color — no multi-material needed).
 *
 * @param activeZones - Set of zone keys that are currently enabled.
 *   Omit to check all zones. Pass only enabled zones to ignore disabled
 *   features (e.g., lip color differs but stacking lip is off).
 */
export function isSingleColor(
  featureColors: FeatureColorConfig,
  activeZones?: ReadonlySet<ColorZone>
): boolean {
  const zones: ColorZone[] = activeZones ? [...activeZones] : ['body', 'lip', 'labelTab'];
  return zones.every((z) => featureColors[z] === featureColors.body);
}

/**
 * Deduplicates zone colors and builds a color-to-index mapping.
 *
 * Shared by both the 3D preview (BinMesh) and 3MF exporter.
 * Returns the unique color list and a lookup from hex color to material index.
 */
export function resolveColorMapping(featureColors: FeatureColorConfig): {
  colors: readonly string[];
  colorToIndex: ReadonlyMap<string, number>;
  defaultIndex: number;
} {
  const colorToIndex = new Map<string, number>();
  const colors: string[] = [];

  // Body first (index 0 = default fallback)
  colorToIndex.set(featureColors.body, 0);
  colors.push(featureColors.body);

  // Add remaining unique colors
  for (const hex of [featureColors.lip, featureColors.labelTab]) {
    if (colorToIndex.has(hex)) continue;
    colorToIndex.set(hex, colors.length);
    colors.push(hex);
  }

  return { colors, colorToIndex, defaultIndex: 0 };
}
