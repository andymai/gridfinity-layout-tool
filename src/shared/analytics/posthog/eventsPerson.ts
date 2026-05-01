/**
 * Person-level analytics: engagement tier, $set/$set_once properties,
 * and the feature-adoption flag store.
 *
 * `updatePersonProperties` is called after significant actions to keep
 * the user's PostHog profile current. `markFeatureUsed` records that
 * a user has touched a feature once — used for adoption funnels.
 *
 * Kept in its own module so the lower-level event trackers
 * (`eventsCore`, `eventsHeartbeat`) can call it without dragging the
 * full events catalog into a circular import.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { loadAnalyticsData, saveAnalyticsData, getFirstSeenDate } from './identity';
import { getPosthogInstance } from './init';
import { computeLayoutMetrics } from './metrics';
import { getDeviceType } from './trackEvent';

/**
 * Compute the engagement tier based on usage patterns.
 */
export function computeEngagementTier(
  layoutCount: number,
  totalBins: number
): 'new' | 'active' | 'power' {
  if (layoutCount >= 5 || totalBins >= 100) return 'power';
  if (layoutCount >= 2 || totalBins >= 20) return 'active';
  return 'new';
}

/**
 * Update person properties in PostHog.
 * Call this after significant actions to keep user profile up-to-date.
 */
export function updatePersonProperties(): void {
  const posthogInstance = getPosthogInstance();
  if (!posthogInstance) return;

  try {
    // Get library data for usage metrics
    const libraryEntries = useLibraryStore.getState().library.entries;
    const layoutCount = libraryEntries.length;

    // Get current layout for feature detection
    const layout = useLayoutStore.getState().layout;
    const metrics = computeLayoutMetrics(layout);

    // Compute cumulative bins (rough estimate from current + saved layouts)
    const currentBins = layout.bins.length;
    const savedBinsEstimate = layoutCount * 10; // Rough average
    const totalBinsEstimate = currentBins + savedBinsEstimate;

    const data = loadAnalyticsData();
    const flags = data.featureFlags;

    // Coerce flag-derived booleans so the payload is consistently
    // boolean. `flags[key]` is typed as boolean but can be `undefined`
    // at runtime for fresh users (no key in the persisted record), so
    // `metrics.x || flags[k]` would leak `undefined` into PostHog's
    // schema. The `?? false` collapses the missing-key case.
    const flag = (key: string): boolean => flags[key] ?? false;

    // Properties that can change ($set)
    posthogInstance.setPersonProperties({
      // Usage metrics
      layout_count: layoutCount,
      total_bins_estimate: totalBinsEstimate,
      last_active: new Date().toISOString(),

      // Feature adoption (has ever used)
      uses_multi_layer: metrics.feature_multi_layer || flag('multi_layer'),
      uses_half_bins: metrics.feature_half_bins || flag('half_bins'),
      uses_custom_categories: metrics.feature_custom_categories || flag('custom_categories'),
      uses_labels: metrics.feature_labels || flag('labels'),
      uses_3d_preview: flag('3d_preview'),
      uses_cloud_share: flag('cloud_share'),
      uses_fill_operations: flag('fill'),
      uses_paint_mode: flag('paint_mode'),

      // Engagement tier
      engagement_tier: computeEngagementTier(layoutCount, totalBinsEstimate),

      // Device preference
      primary_device: getDeviceType(),
    });

    // Properties set only once ($set_once) — immutable user traits.
    // Use the two-arg `setPersonProperties({}, onceProps)` form so PostHog
    // treats them as $set_once. `setPersonPropertiesForFlags` is for flag
    // evaluation context, not once-only persistence, and would let
    // `document.referrer` (which can change between navigations) overwrite
    // the original initial_referrer.
    posthogInstance.setPersonProperties(
      {},
      {
        first_seen: getFirstSeenDate(),
        initial_referrer: document.referrer || 'direct',
        initial_device: getDeviceType(),
      }
    );

    // Track feature adoption in consolidated storage for persistence
    const adoptionChecks: Array<[boolean, string]> = [
      [metrics.feature_multi_layer, 'multi_layer'],
      [metrics.feature_half_bins, 'half_bins'],
      [metrics.feature_custom_categories, 'custom_categories'],
      [metrics.feature_labels, 'labels'],
    ];

    let flagsChanged = false;
    for (const [isActive, key] of adoptionChecks) {
      if (isActive && !flags[key]) {
        flags[key] = true;
        flagsChanged = true;
      }
    }
    if (flagsChanged) {
      saveAnalyticsData(data);
    }
  } catch {
    // Never break the app for analytics
  }
}

/**
 * Mark a feature as used (for adoption tracking).
 */
export function markFeatureUsed(
  feature:
    | 'multi_layer'
    | 'half_bins'
    | 'custom_categories'
    | 'labels'
    | '3d_preview'
    | 'cloud_share'
    | 'fill'
    | 'paint_mode'
    | 'pwa_installed'
): void {
  try {
    const data = loadAnalyticsData();
    if (data.featureFlags[feature]) return; // Already tracked
    data.featureFlags[feature] = true;
    saveAnalyticsData(data);
  } catch {
    // best-effort
  }
  updatePersonProperties();
}
