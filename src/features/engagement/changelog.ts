/**
 * Changelog entries for the "What's New" feature.
 *
 * Add new entries at the TOP of the array (newest first).
 * Each entry has a version string used to track what the user has seen.
 * The `version` field should match the date of release (YYYY-MM-DD).
 */

export interface ChangelogEntry {
  /** Date-based version identifier (YYYY-MM-DD) */
  version: string;
  /** i18n key for the title */
  titleKey: string;
  /** i18n keys for each bullet point */
  itemKeys: string[];
}

/**
 * Changelog entries — newest first.
 * Keep this list to the last ~5 releases to avoid bloat.
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '2026-03-08',
    titleKey: 'changelog.v20260308.title',
    itemKeys: ['changelog.v20260308.item1', 'changelog.v20260308.item2'],
  },
  {
    version: '2026-02-15',
    titleKey: 'changelog.v20260215.title',
    itemKeys: [
      'changelog.v20260215.item1',
      'changelog.v20260215.item2',
      'changelog.v20260215.item3',
    ],
  },
  {
    version: '2026-01-20',
    titleKey: 'changelog.v20260120.title',
    itemKeys: ['changelog.v20260120.item1', 'changelog.v20260120.item2'],
  },
];

const CHANGELOG_STORAGE_KEY = 'gridfinity-changelog-seen';

/**
 * Get the version string of the latest changelog entry the user has seen.
 */
export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Mark the latest changelog version as seen.
 */
export function markChangelogSeen(): void {
  const latest = CHANGELOG_ENTRIES[0] as ChangelogEntry | undefined;
  if (!latest) return;
  try {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, latest.version);
  } catch {
    /* ignore */
  }
}

/**
 * Check if there are unseen changelog entries.
 */
export function hasUnseenChangelog(): boolean {
  if (CHANGELOG_ENTRIES.length === 0) return false;
  const lastSeen = getLastSeenVersion();
  if (!lastSeen) return true; // Never seen any changelog
  return CHANGELOG_ENTRIES[0].version > lastSeen;
}

/**
 * Get the count of unseen changelog entries.
 */
export function getUnseenEntries(): ChangelogEntry[] {
  const lastSeen = getLastSeenVersion();
  if (!lastSeen) return CHANGELOG_ENTRIES;
  return CHANGELOG_ENTRIES.filter((entry) => entry.version > lastSeen);
}
