/**
 * Analytics identity management — user ID, first-seen, storage.
 * Provides stable anonymous user identity for PostHog analytics.
 */

import { generateUUID } from '@/shared/utils';

// ============================================
// CONSOLIDATED ANALYTICS STORAGE
// ============================================

export const ANALYTICS_STORAGE_KEY = 'gridfinity-analytics-v1';

export interface AnalyticsData {
  userId: string;
  firstSeen: string;
  featureFlags: Record<string, boolean>;
  milestones: Record<string, string>;
}

let analyticsCache: AnalyticsData | null = null;

export function createEmptyAnalyticsData(): AnalyticsData {
  return { userId: '', firstSeen: '', featureFlags: {}, milestones: {} };
}

export function loadAnalyticsData(): AnalyticsData {
  if (analyticsCache) return analyticsCache;
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (raw) {
      analyticsCache = JSON.parse(raw) as AnalyticsData;
      return analyticsCache;
    }
  } catch {
    /* ignore */
  }
  analyticsCache = createEmptyAnalyticsData();
  return analyticsCache;
}

export function saveAnalyticsData(data: AnalyticsData): void {
  analyticsCache = data;
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be full */
  }
}

/**
 * Remove all analytics data from localStorage and clear the in-memory cache.
 * Use when analytics is disabled or data should be pruned.
 */
export function pruneAnalyticsData(): void {
  analyticsCache = null;
  try {
    localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ============================================
// STABLE USER IDENTITY
// ============================================

/**
 * Get or create a stable user ID for anonymous users.
 * This persists across sessions within the same browser.
 * Falls back to a session-only UUID if localStorage is unavailable.
 */
export function getStableUserId(): string {
  try {
    const data = loadAnalyticsData();
    if (!data.userId) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- user IDs must remain UUIDs for PostHog identity stability
      data.userId = generateUUID();
      if (!data.firstSeen) {
        data.firstSeen = new Date().toISOString();
      }
      saveAnalyticsData(data);
    }
    return data.userId;
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.)
    // Fall back to a session-only ID
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- user IDs must remain UUIDs for PostHog identity stability
    return generateUUID();
  }
}

/**
 * Get the date this user was first seen.
 * Persists a generated timestamp if missing, to keep it stable across sessions.
 */
export function getFirstSeenDate(): string {
  try {
    const data = loadAnalyticsData();
    if (!data.firstSeen) {
      data.firstSeen = new Date().toISOString();
      saveAnalyticsData(data);
    }
    return data.firstSeen;
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Check if this is the user's first session (within 30 minutes of first_seen).
 */
export function isFirstSession(): boolean {
  try {
    const data = loadAnalyticsData();
    if (!data.firstSeen) return true;

    const firstSeenTime = new Date(data.firstSeen).getTime();
    const thirtyMinutes = 30 * 60 * 1000;

    return Date.now() - firstSeenTime < thirtyMinutes;
  } catch {
    return true;
  }
}
