/**
 * One-time localStorage migrations.
 * Each migration is idempotent (flag-guarded) and runs at app startup.
 */

import { openLayoutDatabase, saveMlData, saveSharedWithMeEntries } from './backends/indexedDB';
import { useSettingsStore } from '@/core/store/settings';
import type { SharedWithMeEntry } from '@/core/types';

function isMigrationDone(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function setMigrationDone(key: string): void {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    // Best-effort
  }
}

// -- Hint flags -> dismissedHints in settings ---------------------------------

const HINT_MIGRATIONS = [
  { old: 'gridfinity-grid-resize-hint-shown', id: 'grid-resize' },
  { old: 'gridfinity-paint-mode-hint-shown', id: 'paint-mode' },
  { old: 'gridfinity-resize-hint-shown', id: 'bin-resize' },
  { old: 'gridfinity-designer-touch-hint-dismissed', id: 'designer-touch' },
] as const;

function migrateHintFlagsToSettings(): void {
  if (isMigrationDone('gridfinity-migration-hints-v1')) return;

  const toAdd: string[] = [];
  for (const { old, id } of HINT_MIGRATIONS) {
    try {
      if (localStorage.getItem(old)) {
        toAdd.push(id);
        localStorage.removeItem(old);
      }
    } catch {
      // Best-effort — continue with remaining work
    }
  }

  if (toAdd.length > 0) {
    const current = useSettingsStore.getState().settings.dismissedHints;
    const merged = [...new Set([...current, ...toAdd])];
    useSettingsStore.getState().updateSetting('dismissedHints', merged);
  }

  setMigrationDone('gridfinity-migration-hints-v1');
}

// -- Analytics consolidation --------------------------------------------------

const OLD_FEATURE_KEYS = [
  'has_used_multi_layer',
  'has_used_half_bins',
  'has_used_custom_categories',
  'has_used_labels',
  'has_used_3d_preview',
  'has_used_cloud_share',
  'has_used_fill',
  'has_used_paint_mode',
] as const;

const OLD_MILESTONE_KEYS = [
  'gridfinity_milestone_first_bin',
  'gridfinity_milestone_engaged',
  'gridfinity_milestone_substantial',
] as const;

function migrateAnalyticsToConsolidatedKey(): void {
  if (isMigrationDone('gridfinity-migration-analytics-v1')) return;

  const hasOldKey = (key: string): boolean => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  };

  // If no old keys exist, nothing to migrate
  if (!OLD_FEATURE_KEYS.some(hasOldKey) && !hasOldKey('gridfinity_user_id')) {
    setMigrationDone('gridfinity-migration-analytics-v1');
    return;
  }

  const featureFlags: Record<string, boolean> = {};
  for (const key of OLD_FEATURE_KEYS) {
    try {
      if (localStorage.getItem(key) === 'true') {
        featureFlags[key.replace('has_used_', '')] = true;
      }
      localStorage.removeItem(key);
    } catch {
      // Best-effort — continue with remaining work
    }
  }

  const milestones: Record<string, string> = {};
  for (const key of OLD_MILESTONE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        milestones[key.replace('gridfinity_milestone_', '')] = value;
      }
      localStorage.removeItem(key);
    } catch {
      // Best-effort — continue with remaining work
    }
  }

  let userId = '';
  let firstSeen = '';
  try {
    userId = localStorage.getItem('gridfinity_user_id') ?? '';
    firstSeen = localStorage.getItem('gridfinity_first_seen') ?? '';
    if (userId) localStorage.removeItem('gridfinity_user_id');
    if (firstSeen) localStorage.removeItem('gridfinity_first_seen');
  } catch {
    /* continue */
  }

  // Merge with any existing consolidated data
  try {
    const existing = localStorage.getItem('gridfinity-analytics-v1');
    const parsed = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
    const consolidated = {
      userId: (parsed['userId'] as string) || userId,
      firstSeen: (parsed['firstSeen'] as string) || firstSeen,
      featureFlags: {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- parsed value may be undefined at runtime
        ...((parsed['featureFlags'] as Record<string, boolean>) ?? {}),
        ...featureFlags,
      },
      milestones: {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- parsed value may be undefined at runtime
        ...((parsed['milestones'] as Record<string, string>) ?? {}),
        ...milestones,
      },
    };
    localStorage.setItem('gridfinity-analytics-v1', JSON.stringify(consolidated));
  } catch {
    /* continue */
  }

  setMigrationDone('gridfinity-migration-analytics-v1');
}

// -- Onboarding keys: underscore -> kebab-case --------------------------------

const ONBOARDING_KEY_RENAMES = [
  { old: 'gridfinity_onboarding_welcome_seen', new: 'gridfinity-onboarding-welcome-seen' },
  {
    old: 'gridfinity_onboarding_draw_tutorial_seen',
    new: 'gridfinity-onboarding-draw-tutorial-seen',
  },
  {
    old: 'gridfinity_onboarding_sidebar_pulse_dismissed',
    new: 'gridfinity-onboarding-sidebar-pulse-dismissed',
  },
  { old: 'gridfinity_onboarding_chose_blank', new: 'gridfinity-onboarding-chose-blank' },
] as const;

function migrateOnboardingKeysToKebab(): void {
  if (isMigrationDone('gridfinity-migration-onboarding-kebab-v1')) return;

  for (const { old, new: newKey } of ONBOARDING_KEY_RENAMES) {
    try {
      const value = localStorage.getItem(old);
      if (value !== null) {
        localStorage.setItem(newKey, value);
        localStorage.removeItem(old);
      }
    } catch {
      // Best-effort — continue with remaining work
    }
  }

  setMigrationDone('gridfinity-migration-onboarding-kebab-v1');
}

// -- ML label sizes: localStorage -> IndexedDB --------------------------------

async function migrateMlLabelSizesToIdb(): Promise<void> {
  if (isMigrationDone('gridfinity-migration-ml-to-idb-v1')) return;

  try {
    const raw = localStorage.getItem('gridfinity-ml-label-sizes-v1');
    if (raw) {
      const data = JSON.parse(raw) as Record<string, string[]>;
      await saveMlData('label-sizes', data);
      localStorage.removeItem('gridfinity-ml-label-sizes-v1');
    }
    setMigrationDone('gridfinity-migration-ml-to-idb-v1');
  } catch {
    // Retry next session — don't set flag
  }
}

// -- Shared-with-me: localStorage -> IndexedDB --------------------------------

async function migrateSharedWithMeToIdb(): Promise<void> {
  if (isMigrationDone('gridfinity-migration-shared-with-me-idb-v1')) return;

  try {
    const raw = localStorage.getItem('gridfinity-shared-with-me-v1');
    if (raw) {
      const parsed = JSON.parse(raw) as { entries?: SharedWithMeEntry[] };
      if (Array.isArray(parsed.entries)) {
        await saveSharedWithMeEntries(parsed.entries);
      }
      // Keep localStorage key — callers still use sync read path.
      // Will be removed when library.ts is migrated to async SharedWithMe API.
    }
    setMigrationDone('gridfinity-migration-shared-with-me-idb-v1');
  } catch {
    // Retry next session
  }
}

// -- Public API ---------------------------------------------------------------

/**
 * Run all one-time localStorage migrations.
 * Called once at app startup after IndexedDB is available.
 */
export async function runLocalStorageMigrations(): Promise<void> {
  await openLayoutDatabase();
  migrateHintFlagsToSettings();
  migrateAnalyticsToConsolidatedKey();
  migrateOnboardingKeysToKebab();
  await migrateMlLabelSizesToIdb();
  await migrateSharedWithMeToIdb();
}
