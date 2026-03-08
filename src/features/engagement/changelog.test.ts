import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasUnseenChangelog,
  markChangelogSeen,
  getLastSeenVersion,
  getUnseenEntries,
  CHANGELOG_ENTRIES,
} from './changelog';

describe('changelog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports unseen changelog for new users', () => {
    expect(hasUnseenChangelog()).toBe(true);
  });

  it('reports no unseen changelog after marking as seen', () => {
    markChangelogSeen();
    expect(hasUnseenChangelog()).toBe(false);
  });

  it('stores the latest version when marking as seen', () => {
    markChangelogSeen();
    expect(getLastSeenVersion()).toBe(CHANGELOG_ENTRIES[0].version);
  });

  it('returns all entries as unseen for new users', () => {
    const unseen = getUnseenEntries();
    expect(unseen).toHaveLength(CHANGELOG_ENTRIES.length);
  });

  it('returns no unseen entries after marking as seen', () => {
    markChangelogSeen();
    const unseen = getUnseenEntries();
    expect(unseen).toHaveLength(0);
  });
});
