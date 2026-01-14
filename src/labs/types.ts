/**
 * Labs Feature Flags - Type Definitions
 *
 * This module defines the types for the Labs experimental features system.
 * Features are user-controlled opt-in experiments that can be toggled on/off.
 */

/**
 * Lifecycle states for experimental features.
 */
export type FeatureStatus =
  | 'experimental' // Active experiment, may have bugs
  | 'preview' // More stable, nearing graduation
  | 'graduated' // Now available to everyone
  | 'deprecated'; // Being phased out

/**
 * Risk level indicators for user awareness.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Definition of an experimental feature.
 */
export interface FeatureFlag {
  /** Unique identifier (snake_case, matches analytics) */
  id: string;

  /** Display name shown in Labs UI */
  name: string;

  /** Brief description of what the feature does */
  description: string;

  /** Current lifecycle status */
  status: FeatureStatus;

  /** Risk level for user awareness */
  risk: RiskLevel;

  /** Optional warning message for medium/high risk features */
  warning?: string;

  /** Optional link to documentation or feedback form */
  learnMoreUrl?: string;

  /** Date feature was added to Labs (YYYY-MM format) */
  addedAt: string;

  /** Date feature graduated (if applicable) */
  graduatedAt?: string;

  /** Whether enabling requires page refresh */
  requiresRefresh: boolean;

  /** Optional feature dependencies (must be enabled first) */
  dependencies?: string[];

  /** Whether feature is coming soon (not yet available to toggle) */
  comingSoon?: boolean;
}

/**
 * User's Labs preferences stored in localStorage.
 */
export interface LabsPreferences {
  /** Map of feature ID → enabled state */
  enabledFeatures: Record<string, boolean>;

  /** Timestamp of last modification (for sync) */
  lastModified: string;

  /** Version for migration support */
  version: number;
}

/**
 * Default preferences for new users.
 */
export const DEFAULT_LABS_PREFERENCES: LabsPreferences = {
  enabledFeatures: {},
  lastModified: new Date().toISOString(),
  version: 1,
};
