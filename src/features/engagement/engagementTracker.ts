/**
 * Engagement tracking for nudge gating.
 *
 * Reads from the existing analytics localStorage (`gridfinity-analytics-v1`)
 * to determine feature breadth. Manages its own nudge cooldown state in a
 * separate key to keep concerns isolated.
 *
 * Engagement gate criteria (all must be true):
 * - 3+ return sessions
 * - 3+ distinct features used
 * - 10+ minutes in the current session
 */

import { useLibraryStore } from '@/core/store/library';

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const NUDGE_STORAGE_KEY = 'gridfinity-nudges-v1';
const ANALYTICS_STORAGE_KEY = 'gridfinity-analytics-v1';

export type NudgeType = 'feedback_rating' | 'kofi_support';

interface NudgeState {
  /** ISO timestamps of when each nudge was last dismissed or acted on */
  cooldowns: Partial<Record<NudgeType, string>>;
  /** Total session count (incremented once per app load) */
  sessionCount: number;
  /** Timestamp of current session start */
  sessionStart: string;
}

function createEmptyNudgeState(): NudgeState {
  return {
    cooldowns: {},
    sessionCount: 0,
    sessionStart: new Date().toISOString(),
  };
}

let nudgeCache: NudgeState | null = null;

/** Clear the in-memory cache. Used in tests to reset state between runs. */
export function resetNudgeCache(): void {
  nudgeCache = null;
}

function loadNudgeState(): NudgeState {
  if (nudgeCache) return nudgeCache;
  try {
    const raw = localStorage.getItem(NUDGE_STORAGE_KEY);
    if (raw) {
      nudgeCache = JSON.parse(raw) as NudgeState;
      return nudgeCache;
    }
  } catch {
    /* ignore */
  }
  nudgeCache = createEmptyNudgeState();
  return nudgeCache;
}

function saveNudgeState(state: NudgeState): void {
  nudgeCache = state;
  try {
    localStorage.setItem(NUDGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be full */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call once at app startup to increment session count and record session start.
 */
export function recordSessionStart(): void {
  const state = loadNudgeState();
  state.sessionCount += 1;
  state.sessionStart = new Date().toISOString();
  saveNudgeState(state);
}

/**
 * Get the number of minutes elapsed in the current session.
 */
export function getSessionMinutes(): number {
  const state = loadNudgeState();
  if (!state.sessionStart) return 0;
  const elapsed = Date.now() - new Date(state.sessionStart).getTime();
  return Math.floor(elapsed / 60_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature breadth (reads from existing analytics data)
// ─────────────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  featureFlags: Record<string, boolean>;
}

function getDistinctFeaturesUsed(): number {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as AnalyticsData;
    return Object.values(data.featureFlags).filter(Boolean).length;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engagement gate
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SESSIONS = 3;
const MIN_FEATURES = 3;
const MIN_SESSION_MINUTES = 10;

export interface EngagementStatus {
  passes: boolean;
  sessionCount: number;
  featuresUsed: number;
  sessionMinutes: number;
}

/**
 * Check whether the current user passes the engagement gate.
 * All three criteria must be met before any nudge is shown.
 */
export function checkEngagementGate(): EngagementStatus {
  const state = loadNudgeState();
  const sessionMinutes = getSessionMinutes();
  const featuresUsed = getDistinctFeaturesUsed();

  // Also factor in layout count as a signal — users with 2+ layouts are engaged
  const layoutCount = useLibraryStore.getState().library.entries.length;
  const effectiveFeatures = featuresUsed + (layoutCount >= 2 ? 1 : 0);

  return {
    passes:
      state.sessionCount >= MIN_SESSIONS &&
      effectiveFeatures >= MIN_FEATURES &&
      sessionMinutes >= MIN_SESSION_MINUTES,
    sessionCount: state.sessionCount,
    featuresUsed: effectiveFeatures,
    sessionMinutes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown management
// ─────────────────────────────────────────────────────────────────────────────

const COOLDOWN_DAYS = 30;

/**
 * Check if a nudge type is currently in cooldown (dismissed within the last 30 days).
 */
export function isInCooldown(nudgeType: NudgeType): boolean {
  const state = loadNudgeState();
  const lastDismissed = state.cooldowns[nudgeType];
  if (!lastDismissed) return false;

  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastDismissed).getTime() < cooldownMs;
}

/**
 * Record that a nudge was dismissed or acted on, starting the cooldown period.
 */
export function recordNudgeDismissal(nudgeType: NudgeType): void {
  const state = loadNudgeState();
  state.cooldowns[nudgeType] = new Date().toISOString();
  saveNudgeState(state);
}

/**
 * Check if a specific nudge should be shown right now.
 * Combines engagement gate + cooldown check.
 */
export function shouldShowNudge(nudgeType: NudgeType): boolean {
  if (isInCooldown(nudgeType)) return false;
  return checkEngagementGate().passes;
}
