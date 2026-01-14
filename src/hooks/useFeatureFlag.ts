/**
 * Feature Flag Hook
 *
 * Provides a simple way to check if a Labs feature is enabled.
 * Handles graduated features (always enabled) and deprecated features (always disabled).
 */

import { useLabsStore } from '../store/labs';
import type { FeatureId } from '../labs/features';

/**
 * Hook to check if a feature flag is enabled.
 * Returns true if the feature is enabled or graduated.
 *
 * @example
 * const isCollabEnabled = useFeatureFlag('collaborative_editing');
 * if (isCollabEnabled) {
 *   // Render collaboration UI
 * }
 */
export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => state.isFeatureEnabled(featureId));
}

/**
 * Imperative check for use outside React components.
 * Useful in event handlers, utility functions, or other non-component code.
 *
 * @example
 * if (isFeatureEnabled('drawer_to_print')) {
 *   // Show export option
 * }
 */
export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
