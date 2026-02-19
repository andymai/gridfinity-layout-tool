import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock IndexedDB backends before importing the module under test
vi.mock('./backends/indexedDB', () => ({
  openLayoutDatabase: vi.fn().mockResolvedValue(undefined),
  saveMlData: vi.fn().mockResolvedValue(undefined),
  saveSharedWithMeEntries: vi.fn().mockResolvedValue(undefined),
}));

import * as indexedDBBackend from './backends/indexedDB';
import { runLocalStorageMigrations } from './localStorageMigrations';
import { useSettingsStore } from '@/core/store/settings';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setMigrationDone(key: string): void {
  localStorage.setItem(key, 'true');
}

function getMigrationDone(key: string): string | null {
  return localStorage.getItem(key);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Reset settings store to clear any dismissedHints from previous tests
  useSettingsStore.getState().resetSettings();
});

// ─── runLocalStorageMigrations ────────────────────────────────────────────────

describe('runLocalStorageMigrations', () => {
  it('opens the layout database before running migrations', async () => {
    await runLocalStorageMigrations();
    expect(indexedDBBackend.openLayoutDatabase).toHaveBeenCalledTimes(1);
  });

  it('runs to completion with no old keys present', async () => {
    await expect(runLocalStorageMigrations()).resolves.toBeUndefined();
  });

  it('sets all done flags after running with no old data', async () => {
    await runLocalStorageMigrations();
    expect(getMigrationDone('gridfinity-migration-hints-v1')).toBe('true');
    expect(getMigrationDone('gridfinity-migration-analytics-v1')).toBe('true');
    expect(getMigrationDone('gridfinity-migration-onboarding-kebab-v1')).toBe('true');
    expect(getMigrationDone('gridfinity-migration-ml-to-idb-v1')).toBe('true');
    expect(getMigrationDone('gridfinity-migration-shared-with-me-idb-v1')).toBe('true');
  });
});

// ─── migrateHintFlagsToSettings ───────────────────────────────────────────────

describe('migrateHintFlagsToSettings', () => {
  it('skips when done flag is set', async () => {
    setMigrationDone('gridfinity-migration-hints-v1');
    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');

    await runLocalStorageMigrations();

    // Old key should still be present (migration was skipped)
    expect(localStorage.getItem('gridfinity-grid-resize-hint-shown')).toBe('true');
    expect(useSettingsStore.getState().settings.dismissedHints).toEqual([]);
  });

  it('sets the done flag after running', async () => {
    await runLocalStorageMigrations();
    expect(getMigrationDone('gridfinity-migration-hints-v1')).toBe('true');
  });

  it('migrates all four hint keys into dismissedHints', async () => {
    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
    localStorage.setItem('gridfinity-paint-mode-hint-shown', 'true');
    localStorage.setItem('gridfinity-resize-hint-shown', 'true');
    localStorage.setItem('gridfinity-designer-touch-hint-dismissed', 'true');

    await runLocalStorageMigrations();

    const dismissed = useSettingsStore.getState().settings.dismissedHints;
    expect(dismissed).toContain('grid-resize');
    expect(dismissed).toContain('paint-mode');
    expect(dismissed).toContain('bin-resize');
    expect(dismissed).toContain('designer-touch');
  });

  it('removes old hint keys from localStorage after migration', async () => {
    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
    localStorage.setItem('gridfinity-paint-mode-hint-shown', 'true');
    localStorage.setItem('gridfinity-resize-hint-shown', 'true');
    localStorage.setItem('gridfinity-designer-touch-hint-dismissed', 'true');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-grid-resize-hint-shown')).toBeNull();
    expect(localStorage.getItem('gridfinity-paint-mode-hint-shown')).toBeNull();
    expect(localStorage.getItem('gridfinity-resize-hint-shown')).toBeNull();
    expect(localStorage.getItem('gridfinity-designer-touch-hint-dismissed')).toBeNull();
  });

  it('migrates only the hint keys that are present', async () => {
    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
    // Others are absent

    await runLocalStorageMigrations();

    const dismissed = useSettingsStore.getState().settings.dismissedHints;
    expect(dismissed).toContain('grid-resize');
    expect(dismissed).not.toContain('paint-mode');
    expect(dismissed).not.toContain('bin-resize');
    expect(dismissed).not.toContain('designer-touch');
  });

  it('merges new hints into existing dismissedHints without duplicates', async () => {
    // Pre-populate settings with an existing hint
    useSettingsStore.getState().updateSetting('dismissedHints', ['paint-mode']);

    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
    localStorage.setItem('gridfinity-paint-mode-hint-shown', 'true'); // duplicate

    await runLocalStorageMigrations();

    const dismissed = useSettingsStore.getState().settings.dismissedHints;
    // Should contain both, deduplicated
    expect(dismissed).toContain('grid-resize');
    expect(dismissed).toContain('paint-mode');
    // No duplicates
    const paintModeCount = dismissed.filter((h) => h === 'paint-mode').length;
    expect(paintModeCount).toBe(1);
  });

  it('does not update dismissedHints when no hint keys are present', async () => {
    const updateSettingSpy = vi.spyOn(useSettingsStore.getState(), 'updateSetting');

    await runLocalStorageMigrations();

    // updateSetting should not have been called for dismissedHints
    const dismissedHintsCalls = updateSettingSpy.mock.calls.filter(
      ([key]) => key === 'dismissedHints'
    );
    expect(dismissedHintsCalls).toHaveLength(0);
  });
});

// ─── migrateAnalyticsToConsolidatedKey ────────────────────────────────────────

describe('migrateAnalyticsToConsolidatedKey', () => {
  it('skips when done flag is set', async () => {
    setMigrationDone('gridfinity-migration-analytics-v1');
    localStorage.setItem('has_used_multi_layer', 'true');

    await runLocalStorageMigrations();

    // Old key should remain (skipped)
    expect(localStorage.getItem('has_used_multi_layer')).toBe('true');
  });

  it('sets the done flag after running', async () => {
    localStorage.setItem('gridfinity_user_id', 'uid-123');

    await runLocalStorageMigrations();

    expect(getMigrationDone('gridfinity-migration-analytics-v1')).toBe('true');
  });

  it('sets done flag even when no old analytics keys exist', async () => {
    await runLocalStorageMigrations();
    expect(getMigrationDone('gridfinity-migration-analytics-v1')).toBe('true');
  });

  it('consolidates feature flag keys into gridfinity-analytics-v1', async () => {
    localStorage.setItem('has_used_multi_layer', 'true');
    localStorage.setItem('has_used_half_bins', 'true');
    localStorage.setItem('gridfinity_user_id', 'uid-abc');

    await runLocalStorageMigrations();

    const raw = localStorage.getItem('gridfinity-analytics-v1');
    expect(raw).not.toBeNull();
    const consolidated = JSON.parse(raw as string) as Record<string, unknown>;
    expect((consolidated['featureFlags'] as Record<string, boolean>)['multi_layer']).toBe(true);
    expect((consolidated['featureFlags'] as Record<string, boolean>)['half_bins']).toBe(true);
    expect(consolidated['userId']).toBe('uid-abc');
  });

  it('removes old feature flag keys from localStorage', async () => {
    localStorage.setItem('has_used_multi_layer', 'true');
    localStorage.setItem('has_used_labels', 'true');
    localStorage.setItem('gridfinity_user_id', 'uid-xyz');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('has_used_multi_layer')).toBeNull();
    expect(localStorage.getItem('has_used_labels')).toBeNull();
    expect(localStorage.getItem('gridfinity_user_id')).toBeNull();
  });

  it('consolidates milestone keys with correct name stripping', async () => {
    localStorage.setItem('gridfinity_milestone_first_bin', '2024-01-01');
    localStorage.setItem('gridfinity_milestone_engaged', '2024-01-02');
    localStorage.setItem('gridfinity_user_id', 'uid-m');

    await runLocalStorageMigrations();

    const raw = localStorage.getItem('gridfinity-analytics-v1');
    const consolidated = JSON.parse(raw as string) as Record<string, unknown>;
    expect((consolidated['milestones'] as Record<string, string>)['first_bin']).toBe('2024-01-01');
    expect((consolidated['milestones'] as Record<string, string>)['engaged']).toBe('2024-01-02');
  });

  it('removes old milestone keys from localStorage', async () => {
    localStorage.setItem('gridfinity_milestone_first_bin', '2024-01-01');
    localStorage.setItem('gridfinity_user_id', 'uid-m');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity_milestone_first_bin')).toBeNull();
  });

  it('merges with existing consolidated data, preferring existing userId', async () => {
    // Already-consolidated data takes precedence for userId/firstSeen
    const existing = {
      userId: 'existing-uid',
      firstSeen: '2023-12-01',
      featureFlags: { fill: true },
      milestones: {},
    };
    localStorage.setItem('gridfinity-analytics-v1', JSON.stringify(existing));
    localStorage.setItem('gridfinity_user_id', 'new-uid');
    localStorage.setItem('has_used_3d_preview', 'true');

    await runLocalStorageMigrations();

    const raw = localStorage.getItem('gridfinity-analytics-v1');
    const consolidated = JSON.parse(raw as string) as Record<string, unknown>;
    // Existing consolidated userId takes precedence
    expect(consolidated['userId']).toBe('existing-uid');
    expect(consolidated['firstSeen']).toBe('2023-12-01');
    // New feature flag is merged in
    expect((consolidated['featureFlags'] as Record<string, boolean>)['fill']).toBe(true);
    expect((consolidated['featureFlags'] as Record<string, boolean>)['3d_preview']).toBe(true);
  });

  it('includes firstSeen from old key', async () => {
    localStorage.setItem('gridfinity_user_id', 'uid-fs');
    localStorage.setItem('gridfinity_first_seen', '2024-06-15');

    await runLocalStorageMigrations();

    const raw = localStorage.getItem('gridfinity-analytics-v1');
    const consolidated = JSON.parse(raw as string) as Record<string, unknown>;
    expect(consolidated['firstSeen']).toBe('2024-06-15');
    expect(localStorage.getItem('gridfinity_first_seen')).toBeNull();
  });

  it('does not include feature flags set to non-true values', async () => {
    localStorage.setItem('has_used_fill', 'false');
    localStorage.setItem('gridfinity_user_id', 'uid-nf');

    await runLocalStorageMigrations();

    const raw = localStorage.getItem('gridfinity-analytics-v1');
    const consolidated = JSON.parse(raw as string) as Record<string, unknown>;
    expect((consolidated['featureFlags'] as Record<string, boolean>)['fill']).toBeUndefined();
  });
});

// ─── migrateOnboardingKeysToKebab ────────────────────────────────────────────

describe('migrateOnboardingKeysToKebab', () => {
  it('skips when done flag is set', async () => {
    setMigrationDone('gridfinity-migration-onboarding-kebab-v1');
    localStorage.setItem('gridfinity_onboarding_welcome_seen', 'true');

    await runLocalStorageMigrations();

    // Old key remains (migration skipped)
    expect(localStorage.getItem('gridfinity_onboarding_welcome_seen')).toBe('true');
    // New key should NOT have been created
    expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBeNull();
  });

  it('sets the done flag after running', async () => {
    await runLocalStorageMigrations();
    expect(getMigrationDone('gridfinity-migration-onboarding-kebab-v1')).toBe('true');
  });

  it('renames gridfinity_onboarding_welcome_seen to kebab-case', async () => {
    localStorage.setItem('gridfinity_onboarding_welcome_seen', 'true');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBe('true');
    expect(localStorage.getItem('gridfinity_onboarding_welcome_seen')).toBeNull();
  });

  it('renames gridfinity_onboarding_draw_tutorial_seen to kebab-case', async () => {
    localStorage.setItem('gridfinity_onboarding_draw_tutorial_seen', 'true');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBe('true');
    expect(localStorage.getItem('gridfinity_onboarding_draw_tutorial_seen')).toBeNull();
  });

  it('renames gridfinity_onboarding_sidebar_pulse_dismissed to kebab-case', async () => {
    localStorage.setItem('gridfinity_onboarding_sidebar_pulse_dismissed', 'true');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-sidebar-pulse-dismissed')).toBe('true');
    expect(localStorage.getItem('gridfinity_onboarding_sidebar_pulse_dismissed')).toBeNull();
  });

  it('renames gridfinity_onboarding_chose_blank to kebab-case', async () => {
    localStorage.setItem('gridfinity_onboarding_chose_blank', 'true');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-chose-blank')).toBe('true');
    expect(localStorage.getItem('gridfinity_onboarding_chose_blank')).toBeNull();
  });

  it('preserves the value when renaming keys', async () => {
    localStorage.setItem('gridfinity_onboarding_welcome_seen', 'custom-value');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBe('custom-value');
  });

  it('does not create new key when old key is absent', async () => {
    // No old onboarding keys set

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBeNull();
    expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBeNull();
  });

  it('renames all four keys in one pass', async () => {
    localStorage.setItem('gridfinity_onboarding_welcome_seen', 'true');
    localStorage.setItem('gridfinity_onboarding_draw_tutorial_seen', 'true');
    localStorage.setItem('gridfinity_onboarding_sidebar_pulse_dismissed', 'true');
    localStorage.setItem('gridfinity_onboarding_chose_blank', 'true');

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBe('true');
    expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBe('true');
    expect(localStorage.getItem('gridfinity-onboarding-sidebar-pulse-dismissed')).toBe('true');
    expect(localStorage.getItem('gridfinity-onboarding-chose-blank')).toBe('true');
    // Originals gone
    expect(localStorage.getItem('gridfinity_onboarding_welcome_seen')).toBeNull();
    expect(localStorage.getItem('gridfinity_onboarding_draw_tutorial_seen')).toBeNull();
    expect(localStorage.getItem('gridfinity_onboarding_sidebar_pulse_dismissed')).toBeNull();
    expect(localStorage.getItem('gridfinity_onboarding_chose_blank')).toBeNull();
  });
});

// ─── migrateMlLabelSizesToIdb ─────────────────────────────────────────────────

describe('migrateMlLabelSizesToIdb', () => {
  it('skips when done flag is set', async () => {
    setMigrationDone('gridfinity-migration-ml-to-idb-v1');
    localStorage.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify({ small: ['3x3', '2x2'] }));

    await runLocalStorageMigrations();

    expect(indexedDBBackend.saveMlData).not.toHaveBeenCalled();
    // Old key remains untouched
    expect(localStorage.getItem('gridfinity-ml-label-sizes-v1')).not.toBeNull();
  });

  it('sets the done flag after running when no data present', async () => {
    await runLocalStorageMigrations();
    expect(getMigrationDone('gridfinity-migration-ml-to-idb-v1')).toBe('true');
  });

  it('does not call saveMlData when old key is absent', async () => {
    await runLocalStorageMigrations();
    expect(indexedDBBackend.saveMlData).not.toHaveBeenCalled();
  });

  it('calls saveMlData with parsed label sizes data', async () => {
    const labelSizes = { small: ['3x3', '2x2'], large: ['5x5'] };
    localStorage.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify(labelSizes));

    await runLocalStorageMigrations();

    expect(indexedDBBackend.saveMlData).toHaveBeenCalledWith('label-sizes', labelSizes);
  });

  it('removes localStorage key after successful migration', async () => {
    localStorage.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify({ medium: ['4x4'] }));

    await runLocalStorageMigrations();

    expect(localStorage.getItem('gridfinity-ml-label-sizes-v1')).toBeNull();
  });

  it('sets done flag after successful migration', async () => {
    localStorage.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify({ a: ['1x1'] }));

    await runLocalStorageMigrations();

    expect(getMigrationDone('gridfinity-migration-ml-to-idb-v1')).toBe('true');
  });

  it('does not set done flag when saveMlData throws', async () => {
    vi.mocked(indexedDBBackend.saveMlData).mockRejectedValueOnce(new Error('IDB write error'));
    localStorage.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify({ a: ['1x1'] }));

    await runLocalStorageMigrations();

    // Flag should NOT be set so it retries next session
    expect(getMigrationDone('gridfinity-migration-ml-to-idb-v1')).toBeNull();
  });
});

// ─── migrateSharedWithMeToIdb ─────────────────────────────────────────────────

describe('migrateSharedWithMeToIdb', () => {
  it('skips when done flag is set', async () => {
    setMigrationDone('gridfinity-migration-shared-with-me-idb-v1');
    const entries = [{ id: 'share-1', name: 'Test', addedAt: 0 }];
    localStorage.setItem('gridfinity-shared-with-me-v1', JSON.stringify({ entries }));

    await runLocalStorageMigrations();

    expect(indexedDBBackend.saveSharedWithMeEntries).not.toHaveBeenCalled();
  });

  it('sets the done flag after running when no data present', async () => {
    await runLocalStorageMigrations();
    expect(getMigrationDone('gridfinity-migration-shared-with-me-idb-v1')).toBe('true');
  });

  it('does not call saveSharedWithMeEntries when old key is absent', async () => {
    await runLocalStorageMigrations();
    expect(indexedDBBackend.saveSharedWithMeEntries).not.toHaveBeenCalled();
  });

  it('calls saveSharedWithMeEntries with the parsed entries array', async () => {
    const entries = [
      { id: 'share-1', name: 'Layout A', addedAt: 1700000000000 },
      { id: 'share-2', name: 'Layout B', addedAt: 1700000001000 },
    ];
    localStorage.setItem('gridfinity-shared-with-me-v1', JSON.stringify({ entries }));

    await runLocalStorageMigrations();

    expect(indexedDBBackend.saveSharedWithMeEntries).toHaveBeenCalledWith(entries);
  });

  it('does NOT remove localStorage key after migration (kept for sync read path)', async () => {
    const entries = [{ id: 'share-1', name: 'Layout A', addedAt: 0 }];
    const rawValue = JSON.stringify({ entries });
    localStorage.setItem('gridfinity-shared-with-me-v1', rawValue);

    await runLocalStorageMigrations();

    // Key must still be present
    expect(localStorage.getItem('gridfinity-shared-with-me-v1')).toBe(rawValue);
  });

  it('sets done flag after successful migration', async () => {
    const entries = [{ id: 'share-1', name: 'Layout A', addedAt: 0 }];
    localStorage.setItem('gridfinity-shared-with-me-v1', JSON.stringify({ entries }));

    await runLocalStorageMigrations();

    expect(getMigrationDone('gridfinity-migration-shared-with-me-idb-v1')).toBe('true');
  });

  it('does not call saveSharedWithMeEntries when entries is not an array', async () => {
    localStorage.setItem('gridfinity-shared-with-me-v1', JSON.stringify({ entries: 'bad' }));

    await runLocalStorageMigrations();

    expect(indexedDBBackend.saveSharedWithMeEntries).not.toHaveBeenCalled();
    // Done flag still set (nothing to migrate)
    expect(getMigrationDone('gridfinity-migration-shared-with-me-idb-v1')).toBe('true');
  });

  it('does not set done flag when saveSharedWithMeEntries throws', async () => {
    vi.mocked(indexedDBBackend.saveSharedWithMeEntries).mockRejectedValueOnce(
      new Error('IDB write error')
    );
    const entries = [{ id: 'share-1', name: 'Layout A', addedAt: 0 }];
    localStorage.setItem('gridfinity-shared-with-me-v1', JSON.stringify({ entries }));

    await runLocalStorageMigrations();

    // Flag should NOT be set so it retries next session
    expect(getMigrationDone('gridfinity-migration-shared-with-me-idb-v1')).toBeNull();
  });

  it('sets done flag and skips saveSharedWithMeEntries when entries array is empty', async () => {
    localStorage.setItem('gridfinity-shared-with-me-v1', JSON.stringify({ entries: [] }));

    await runLocalStorageMigrations();

    // Array.isArray([]) is true, so saveSharedWithMeEntries is called with empty array
    expect(indexedDBBackend.saveSharedWithMeEntries).toHaveBeenCalledWith([]);
    expect(getMigrationDone('gridfinity-migration-shared-with-me-idb-v1')).toBe('true');
  });
});

// ─── Idempotency: all migrations skipped when all done flags are set ──────────

describe('idempotency', () => {
  it('skips all migrations when all done flags are present', async () => {
    setMigrationDone('gridfinity-migration-hints-v1');
    setMigrationDone('gridfinity-migration-analytics-v1');
    setMigrationDone('gridfinity-migration-onboarding-kebab-v1');
    setMigrationDone('gridfinity-migration-ml-to-idb-v1');
    setMigrationDone('gridfinity-migration-shared-with-me-idb-v1');

    // Put old keys in to prove they are NOT processed
    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
    localStorage.setItem('has_used_multi_layer', 'true');
    localStorage.setItem('gridfinity_onboarding_welcome_seen', 'true');
    localStorage.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify({ a: ['1x1'] }));
    localStorage.setItem(
      'gridfinity-shared-with-me-v1',
      JSON.stringify({ entries: [{ id: 'x', name: 'y', addedAt: 0 }] })
    );

    await runLocalStorageMigrations();

    expect(indexedDBBackend.saveMlData).not.toHaveBeenCalled();
    expect(indexedDBBackend.saveSharedWithMeEntries).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().settings.dismissedHints).toEqual([]);
    expect(localStorage.getItem('gridfinity-grid-resize-hint-shown')).toBe('true');
    expect(localStorage.getItem('has_used_multi_layer')).toBe('true');
    expect(localStorage.getItem('gridfinity_onboarding_welcome_seen')).toBe('true');
  });

  it('is safe to call runLocalStorageMigrations multiple times', async () => {
    localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
    localStorage.setItem(
      'gridfinity-shared-with-me-v1',
      JSON.stringify({ entries: [{ id: 'x', name: 'y', addedAt: 0 }] })
    );

    await runLocalStorageMigrations();
    await runLocalStorageMigrations();

    // saveMlData not relevant here (no ml data), saveSharedWithMeEntries called once only
    expect(indexedDBBackend.saveSharedWithMeEntries).toHaveBeenCalledTimes(1);
    const dismissed = useSettingsStore.getState().settings.dismissedHints;
    const gridResizeCount = dismissed.filter((h) => h === 'grid-resize').length;
    expect(gridResizeCount).toBe(1);
  });
});
