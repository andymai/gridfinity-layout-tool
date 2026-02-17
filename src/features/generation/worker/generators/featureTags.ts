/**
 * Feature tags for face provenance tracking.
 *
 * Each tag identifies the modeling step that created a face.
 * Used for feature-colored preview and multi-color 3MF export.
 */
export const FeatureTag = {
  BASE: 0,
  SHELL: 1,
  SCOOP: 2,
  LABEL_TAB: 3,
  SOCKET: 4,
  LIP: 5,
  WALL_CUTOUT: 6,
  DIVIDER: 7,
  SLOT: 8,
  INSERT: 9,
  CUTOUT: 10,
  UNKNOWN: 255,
} as const;

export type FeatureTag = (typeof FeatureTag)[keyof typeof FeatureTag];

const TAG_NAMES: Record<number, string> = {
  [FeatureTag.BASE]: 'Base',
  [FeatureTag.SHELL]: 'Shell',
  [FeatureTag.SCOOP]: 'Scoop',
  [FeatureTag.LABEL_TAB]: 'Label Tab',
  [FeatureTag.SOCKET]: 'Socket',
  [FeatureTag.LIP]: 'Lip',
  [FeatureTag.WALL_CUTOUT]: 'Wall Cutout',
  [FeatureTag.DIVIDER]: 'Divider',
  [FeatureTag.SLOT]: 'Slot',
  [FeatureTag.INSERT]: 'Insert',
  [FeatureTag.CUTOUT]: 'Cutout',
  [FeatureTag.UNKNOWN]: 'Unknown',
};

/** Human-readable name for a feature tag. */
export function featureTagName(tag: number): string {
  return TAG_NAMES[tag] ?? 'Unknown';
}

/**
 * Colors for feature tags (accessible, colorblind-friendly palette).
 * Hex strings for use in Three.js materials and 3MF export.
 */
export const FEATURE_TAG_COLORS: Record<number, string> = {
  [FeatureTag.BASE]: '#9CA3AF',
  [FeatureTag.SHELL]: '#64748B',
  [FeatureTag.SCOOP]: '#3B82F6',
  [FeatureTag.LABEL_TAB]: '#22C55E',
  [FeatureTag.SOCKET]: '#F97316',
  [FeatureTag.LIP]: '#A855F7',
  [FeatureTag.WALL_CUTOUT]: '#EF4444',
  [FeatureTag.DIVIDER]: '#14B8A6',
  [FeatureTag.SLOT]: '#EAB308',
  [FeatureTag.INSERT]: '#EC4899',
  [FeatureTag.CUTOUT]: '#F59E0B',
  [FeatureTag.UNKNOWN]: '#6B7280',
};
