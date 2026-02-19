/**
 * Clear all application data except user settings.
 *
 * This is a destructive action that removes:
 * - All layouts and their IndexedDB data
 * - All snapshots
 * - ML data and shared-with-me entries
 * - Analytics data
 * - Onboarding flags
 * - Migration flags
 *
 * Preserves:
 * - gridfinity-settings-v1 (user preferences)
 */

import { clearAllData as clearIndexedDB } from './backends/indexedDB';
import { pruneAnalyticsData } from '@/shared/analytics/posthog';
import { clearLabelSizesCache } from '@/shared/analytics/purposeInference';

/** Keys that should be preserved during a full data clear. */
const PRESERVED_KEYS = new Set(['gridfinity-settings-v1']);

/**
 * Clear all app data except settings.
 * After calling this, the user should reload the page for a clean state.
 */
export function clearAllAppData(): void {
  // 1. Clear IndexedDB (layouts, snapshots, ml-data, shared-with-me, library)
  clearIndexedDB();

  // 2. Clear analytics data and in-memory cache
  pruneAnalyticsData();

  // 3. Clear ML label sizes in-memory cache
  clearLabelSizesCache();

  // 4. Clear all localStorage keys except preserved ones
  // Keys are collected before removal because deleting during iteration skips entries.
  try {
    const keysToRemove = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i)
    ).filter((key): key is string => key !== null && !PRESERVED_KEYS.has(key));

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    /* localStorage may be unavailable */
  }
}
