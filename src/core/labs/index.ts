// Re-export from new location for backward compatibility
// TODO: Remove in Phase 6 - update all imports to use features/labs
export type { FeatureFlag, FeatureStatus, RiskLevel, LabsPreferences } from '../../features/labs';
export { createDefaultLabsPreferences } from '../../features/labs';

export type { FeatureId } from '../../features/labs';
export {
  FEATURE_FLAGS,
  getFeature,
  getActiveFeatures,
  getGraduatedFeatures,
  getToggleableFeatures,
} from '../../features/labs';
