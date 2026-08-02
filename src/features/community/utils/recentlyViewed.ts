const RECENTLY_VIEWED_KEY = 'gridfinity-community-recently-viewed-v1';

export const RECENTLY_VIEWED_CAP = 50;

export interface RecentlyViewedEntry {
  readonly id: string;
  readonly viewedAt: number;
}

function isEntry(value: unknown): value is RecentlyViewedEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).viewedAt === 'number'
  );
}

export function loadRecentlyViewed(): RecentlyViewedEntry[] {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/** Most-recent-first design ids, the order the recently-viewed filter renders. */
export function loadRecentlyViewedIds(): string[] {
  return loadRecentlyViewed().map((entry) => entry.id);
}

export function recordRecentlyViewed(id: string): void {
  try {
    const existing = loadRecentlyViewed().filter((entry) => entry.id !== id);
    const next = [{ id, viewedAt: Date.now() }, ...existing].slice(0, RECENTLY_VIEWED_CAP);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Private browsing or quota: recently-viewed just stays empty.
  }
}
