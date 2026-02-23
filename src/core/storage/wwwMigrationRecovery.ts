/**
 * Recovery for canonical-domain users who went through a broken www→canonical migration.
 *
 * The original migration incorrectly copied `gridfinity-indexeddb-migrated` and
 * `gridfinity-localstorage-cleaned` from www LS to canonical LS. This prevented
 * the canonical LS→IDB migration from running (`isMigrationNeeded()` returned false),
 * leaving layout data stranded in canonical LS and invisible to the app (which reads
 * from IDB). `reconcileLibraryAsync` then pruned those entries → empty layout.
 *
 * Detection: migration flag is set AND LS still has `gridfinity-layout-{uuid}` keys.
 * For users who legitimately completed migration on canonical, `cleanupLocalStorageBackups`
 * would have removed those LS keys afterward — so their presence alongside the flag
 * means the flag was transferred from www, not earned on canonical.
 *
 * Recovery: clear both falsely-transferred flags → reload so `useStorageMigration`
 * runs the LS→IDB migration cleanly on the next boot.
 */

// These must match the constants in migration.ts and localStorageCleanup.ts.
const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';
const MIGRATION_FLAG_KEY = 'gridfinity-indexeddb-migrated';
const CLEANUP_FLAG_KEY = 'gridfinity-localstorage-cleaned';

/**
 * Detect and silently recover from a bad www→canonical migration.
 *
 * Must be called before React boots so the corrected flags take effect during
 * initial store hydration. Returns true if a page reload was triggered
 * (caller should stop all further initialization).
 */
export function recoverFromBadWwwMigration(): boolean {
  // Only applies to the canonical domain.
  if (window.location.hostname === 'www.gridfinitylayouttool.com') return false;

  // If the migration flag is not set, nothing to recover.
  if (window.localStorage.getItem(MIGRATION_FLAG_KEY) !== 'true') return false;

  // If LS still has layout-{uuid} keys alongside the migration flag, the flag
  // was transferred from www: `migrateAllLayoutsToIndexedDB` and
  // `cleanupLocalStorageBackups` never ran on canonical.
  const hasStrandedLayouts = Object.keys(window.localStorage).some(
    (key) => key.startsWith(LAYOUT_KEY_PREFIX) && key !== `${LAYOUT_KEY_PREFIX}v1`
  );

  if (!hasStrandedLayouts) return false;

  // Reset both flags so `isMigrationNeeded()` returns true and cleanup runs
  // after migration completes.
  window.localStorage.removeItem(MIGRATION_FLAG_KEY);
  window.localStorage.removeItem(CLEANUP_FLAG_KEY);

  // Reload so useStorageMigration picks up the reset state and runs LS→IDB migration.
  window.location.reload();
  return true;
}
