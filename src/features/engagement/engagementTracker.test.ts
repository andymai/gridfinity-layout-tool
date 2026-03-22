// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordSessionStart,
  getSessionMinutes,
  checkEngagementGate,
  shouldShowNudge,
  recordNudgeDismissal,
  isInCooldown,
  resetNudgeCache,
} from './engagementTracker';

// Mock the library store
vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({
      library: { entries: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    }),
  },
}));

describe('engagementTracker', () => {
  beforeEach(() => {
    localStorage.clear();
    resetNudgeCache();
  });

  describe('recordSessionStart', () => {
    it('increments session count on each call', () => {
      recordSessionStart();
      recordSessionStart();
      recordSessionStart();
      const status = checkEngagementGate();
      expect(status.sessionCount).toBe(3);
    });
  });

  describe('getSessionMinutes', () => {
    it('returns 0 for a fresh session', () => {
      recordSessionStart();
      expect(getSessionMinutes()).toBe(0);
    });

    it('returns elapsed minutes', () => {
      // Manually set session start to 15 minutes ago
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000).toISOString();
      localStorage.setItem(
        'gridfinity-nudges-v1',
        JSON.stringify({
          cooldowns: {},
          sessionCount: 1,
          sessionStart: fifteenMinutesAgo,
        })
      );
      expect(getSessionMinutes()).toBe(15);
    });
  });

  describe('checkEngagementGate', () => {
    it('fails when no criteria are met', () => {
      recordSessionStart();
      const status = checkEngagementGate();
      expect(status.passes).toBe(false);
    });

    it('passes when all criteria are met', () => {
      // Set up: 3+ sessions, 10+ min elapsed, 3+ features
      const tenMinutesAgo = new Date(Date.now() - 11 * 60_000).toISOString();
      localStorage.setItem(
        'gridfinity-nudges-v1',
        JSON.stringify({
          cooldowns: {},
          sessionCount: 5,
          sessionStart: tenMinutesAgo,
        })
      );
      // 3+ features in analytics storage (library already has 3 entries = +1 bonus)
      localStorage.setItem(
        'gridfinity-analytics-v1',
        JSON.stringify({
          userId: 'test',
          firstSeen: '',
          featureFlags: { fill: true, multi_layer: true, labels: true },
          milestones: {},
        })
      );

      const status = checkEngagementGate();
      expect(status.passes).toBe(true);
      expect(status.sessionCount).toBe(5);
      expect(status.featuresUsed).toBe(4); // 3 flags + 1 for 3 layouts
      expect(status.sessionMinutes).toBeGreaterThanOrEqual(10);
    });

    it('fails when session time is insufficient', () => {
      localStorage.setItem(
        'gridfinity-nudges-v1',
        JSON.stringify({
          cooldowns: {},
          sessionCount: 5,
          sessionStart: new Date().toISOString(), // Just started
        })
      );
      localStorage.setItem(
        'gridfinity-analytics-v1',
        JSON.stringify({
          userId: 'test',
          firstSeen: '',
          featureFlags: { fill: true, multi_layer: true, labels: true },
          milestones: {},
        })
      );

      const status = checkEngagementGate();
      expect(status.passes).toBe(false);
      expect(status.sessionMinutes).toBe(0);
    });
  });

  describe('cooldown management', () => {
    it('is not in cooldown for a fresh nudge type', () => {
      expect(isInCooldown('feedback_rating')).toBe(false);
    });

    it('enters cooldown after dismissal', () => {
      recordNudgeDismissal('feedback_rating');
      expect(isInCooldown('feedback_rating')).toBe(true);
    });

    it('cooldown expires after 30 days', () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(
        'gridfinity-nudges-v1',
        JSON.stringify({
          cooldowns: { feedback_rating: thirtyOneDaysAgo },
          sessionCount: 1,
          sessionStart: new Date().toISOString(),
        })
      );
      expect(isInCooldown('feedback_rating')).toBe(false);
    });

    it('cooldowns are independent per nudge type', () => {
      recordNudgeDismissal('feedback_rating');
      expect(isInCooldown('feedback_rating')).toBe(true);
      expect(isInCooldown('kofi_support')).toBe(false);
    });
  });

  describe('shouldShowNudge', () => {
    it('returns false when engagement gate fails', () => {
      recordSessionStart(); // Only 1 session
      expect(shouldShowNudge('feedback_rating')).toBe(false);
    });

    it('returns false when in cooldown even if engagement passes', () => {
      const tenMinutesAgo = new Date(Date.now() - 11 * 60_000).toISOString();
      localStorage.setItem(
        'gridfinity-nudges-v1',
        JSON.stringify({
          cooldowns: { feedback_rating: new Date().toISOString() },
          sessionCount: 5,
          sessionStart: tenMinutesAgo,
        })
      );
      localStorage.setItem(
        'gridfinity-analytics-v1',
        JSON.stringify({
          userId: 'test',
          firstSeen: '',
          featureFlags: { fill: true, multi_layer: true, labels: true },
          milestones: {},
        })
      );

      expect(shouldShowNudge('feedback_rating')).toBe(false);
    });
  });
});
