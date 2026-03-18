/**
 * Labs feature flag infrastructure.
 *
 * This module provides the core feature flag system used throughout the application.
 * It belongs in core/ because it's infrastructure that other modules depend on,
 * not a specific user-facing feature.
 *
 * UI components for the labs feature (drawer, button, etc.) remain in features/labs/.
 */

export type { FeatureStatus, RiskLevel, FeatureFlag, LabsPreferences } from './types';
export { createDefaultLabsPreferences } from './types';

// Feature definitions
export type { FeatureId } from './features';
export {
  FEATURE_FLAGS,
  getFeature,
  getActiveFeatures,
  getGraduatedFeatures,
  getToggleableFeatures,
} from './features';
