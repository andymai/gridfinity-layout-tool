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
import { SETTINGS_STORAGE_KEY } from './storageKeys';

/** Keys that should be preserved during a full data clear. */
const PRESERVED_KEYS = new Set([SETTINGS_STORAGE_KEY]);

/**
 * Clear all app data except settings.
 * Awaits IndexedDB clearing before returning so callers can safely reload.
 */
export async function clearAllAppData(): Promise<void> {
  // Sync operations first so they always complete regardless of IDB timing.

  pruneAnalyticsData();

  clearLabelSizesCache();

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

  await clearIndexedDB();
}
