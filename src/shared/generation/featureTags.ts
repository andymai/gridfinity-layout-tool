/**
 * Re-exports feature tag utilities for cross-feature consumption.
 *
 * The canonical definitions live in features/generation/worker/generators/featureTags.
 * This barrel export allows other features (e.g., bin-designer) to
 * use feature tag colors and names without a cross-feature import violation.
 */
export {
  FeatureTag,
  featureTagName,
  FEATURE_TAG_COLORS,
} from '@/features/generation/worker/generators/featureTags';
export type { FeatureTag as FeatureTagType } from '@/features/generation/worker/generators/featureTags';
