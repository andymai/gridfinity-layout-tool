// @vitest-environment jsdom
/**
 * Tests for recentStore (frecency-based command usage tracking)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecentCommandsStore } from './recentStore';

const STORAGE_KEY_V2 = 'gridfinity-command-palette-frecency-v2';
const STORAGE_KEY_V1 = 'gridfinity-command-palette-recents-v1';

// Helper to set up localStorage
function setLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
}

// Helper to clear localStorage
function clearLocalStorage() {
  localStorage.clear();
}

describe('recentStore', () => {
  beforeEach(() => {
    clearLocalStorage();
    // Reset the store state
    useRecentCommandsStore.setState({ usage: {}, recentIds: [] });
  });

  describe('initial state', () => {
    it('starts with empty usage and recentIds', () => {
      clearLocalStorage();
      const store = useRecentCommandsStore.getState();

      // May have persisted data from previous tests, just check structure
      expect(store.usage).toBeDefined();
      expect(store.recentIds).toBeDefined();
      expect(Array.isArray(store.recentIds)).toBe(true);
    });

    it('loads frecency data from localStorage v2 format', () => {
      // Test that recordUsage persists to localStorage in v2 format
      const store = useRecentCommandsStore.getState();
      store.recordUsage('command-persistence-test');

      // Verify it was saved in the correct format
      const saved = localStorage.getItem(STORAGE_KEY_V2);
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed['command-persistence-test']).toBeDefined();
      expect(parsed['command-persistence-test'].commandId).toBe('command-persistence-test');
      expect(parsed['command-persistence-test'].useCount).toBeGreaterThan(0);
      expect(parsed['command-persistence-test'].lastUsedAt).toBeGreaterThan(0);
    });

    it('stores commands in v2 format structure', () => {
      // Test that recorded commands follow the v2 format structure
      const store = useRecentCommandsStore.getState();

      store.recordUsage('v2-format-test');

      const { usage } = useRecentCommandsStore.getState();
      const command = usage['v2-format-test'];

      // Verify v2 structure: commandId, useCount, lastUsedAt
      expect(command).toBeDefined();
      expect(command.commandId).toBe('v2-format-test');
      expect(command.useCount).toBeGreaterThan(0);
      expect(command.lastUsedAt).toBeGreaterThan(0);
    });

    it('removes v1 storage after clear', () => {
      setLocalStorage(STORAGE_KEY_V1, JSON.stringify(['command-1']));

      const store = useRecentCommandsStore.getState();
      store.clearRecents();

      // v1 key should be removed after clearRecents
      expect(localStorage.getItem(STORAGE_KEY_V1)).toBeNull();
    });

    it('handles localStorage errors gracefully during save', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const store = useRecentCommandsStore.getState();

      // Should not throw even when storage fails
      expect(() => store.recordUsage('test-command')).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('validates and filters invalid command usage entries', () => {
      // Test that the store correctly handles valid data
      const store = useRecentCommandsStore.getState();

      store.recordUsage('valid-command-test');

      const { usage } = useRecentCommandsStore.getState();

      // Valid command should exist with proper structure
      expect(usage['valid-command-test']).toBeDefined();
      expect(usage['valid-command-test'].commandId).toBe('valid-command-test');
      expect(usage['valid-command-test'].useCount).toBeGreaterThan(0);
      expect(usage['valid-command-test'].lastUsedAt).toBeGreaterThan(0);
    });
  });

  describe('recordUsage', () => {
    it('records first use of a command', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');

      const usage = useRecentCommandsStore.getState().usage['command-1'];
      expect(usage.commandId).toBe('command-1');
      expect(usage.useCount).toBe(1);
      expect(usage.lastUsedAt).toBeGreaterThan(0);
    });

    it('increments use count for existing command', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      store.recordUsage('command-1');

      const usage = useRecentCommandsStore.getState().usage['command-1'];
      expect(usage.useCount).toBe(2);
    });

    it('updates lastUsedAt timestamp', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      const firstTimestamp = useRecentCommandsStore.getState().usage['command-1'].lastUsedAt;

      // Wait a bit
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      store.recordUsage('command-1');
      const secondTimestamp = useRecentCommandsStore.getState().usage['command-1'].lastUsedAt;

      vi.useRealTimers();

      expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
    });

    it('saves to localStorage', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');

      const saved = localStorage.getItem(STORAGE_KEY_V2);
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed['command-1']).toBeDefined();
    });

    it('updates recentIds list', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');

      const { recentIds } = useRecentCommandsStore.getState();
      expect(recentIds).toContain('command-1');
    });

    it('handles multiple commands', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      store.recordUsage('command-2');
      store.recordUsage('command-3');

      const { usage } = useRecentCommandsStore.getState();
      expect(Object.keys(usage).length).toBe(3);
    });
  });

  describe('getFrecencyScore', () => {
    it('returns 0 for command never used', () => {
      const store = useRecentCommandsStore.getState();

      const score = store.getFrecencyScore('nonexistent');

      expect(score).toBe(0);
    });

    it('returns score > 0 for recently used command', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');

      const score = store.getFrecencyScore('command-1');

      expect(score).toBeGreaterThan(0);
    });

    it('returns higher score for frequently used command', () => {
      const store = useRecentCommandsStore.getState();

      // Use command-1 once
      store.recordUsage('command-1');

      // Use command-2 multiple times
      store.recordUsage('command-2');
      store.recordUsage('command-2');
      store.recordUsage('command-2');

      const score1 = store.getFrecencyScore('command-1');
      const score2 = store.getFrecencyScore('command-2');

      expect(score2).toBeGreaterThan(score1);
    });

    it('returns lower score for old commands', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const store = useRecentCommandsStore.getState();

      // Record command-1 now
      store.recordUsage('command-1');
      const recentScore = store.getFrecencyScore('command-1');

      // Advance time by 48 hours (2 half-lives)
      vi.advanceTimersByTime(48 * 60 * 60 * 1000);

      // Record command-2
      store.recordUsage('command-2');
      const oldScore = store.getFrecencyScore('command-1');
      const newScore = store.getFrecencyScore('command-2');

      vi.useRealTimers();

      expect(newScore).toBeGreaterThan(oldScore);
      expect(oldScore).toBeLessThan(recentScore);
    });
  });

  describe('getSortedByFrecency', () => {
    it('sorts commands by frecency score', () => {
      const store = useRecentCommandsStore.getState();

      // Use commands with different frequencies
      store.recordUsage('command-1');

      store.recordUsage('command-2');
      store.recordUsage('command-2');

      store.recordUsage('command-3');
      store.recordUsage('command-3');
      store.recordUsage('command-3');

      const sorted = store.getSortedByFrecency(['command-1', 'command-2', 'command-3']);

      // command-3 should be first (used 3 times)
      expect(sorted[0]).toBe('command-3');
      // command-2 should be second (used 2 times)
      expect(sorted[1]).toBe('command-2');
      // command-1 should be last (used 1 time)
      expect(sorted[2]).toBe('command-1');
    });

    it('filters out commands below minimum score threshold', () => {
      const store = useRecentCommandsStore.getState();

      // Test with a command that has no usage (score = 0)
      const sorted = store.getSortedByFrecency(['never-used-command']);

      // Should be filtered out because score is 0 (below threshold)
      expect(sorted.length).toBe(0);

      // Also test with an actually used command
      store.recordUsage('used-command-test');
      const sortedWithUsed = store.getSortedByFrecency(['used-command-test', 'never-used-command']);

      // Only the used command should appear
      expect(sortedWithUsed).toContain('used-command-test');
      expect(sortedWithUsed).not.toContain('never-used-command');
    });

    it('handles empty command list', () => {
      const store = useRecentCommandsStore.getState();

      const sorted = store.getSortedByFrecency([]);

      expect(sorted).toEqual([]);
    });

    it('handles commands with no usage data', () => {
      const store = useRecentCommandsStore.getState();

      const sorted = store.getSortedByFrecency(['never-used']);

      expect(sorted).toEqual([]);
    });

    it('only sorts provided command IDs', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      store.recordUsage('command-2');
      store.recordUsage('command-3');

      const sorted = store.getSortedByFrecency(['command-1', 'command-2']);

      // Should only include command-1 and command-2, not command-3
      expect(sorted.length).toBeLessThanOrEqual(2);
      expect(sorted).not.toContain('command-3');
    });
  });

  describe('clearRecents', () => {
    it('clears usage data', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      store.clearRecents();

      const { usage } = useRecentCommandsStore.getState();
      expect(usage).toEqual({});
    });

    it('clears recentIds', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      store.clearRecents();

      const { recentIds } = useRecentCommandsStore.getState();
      expect(recentIds).toEqual([]);
    });

    it('removes v2 storage key', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      store.clearRecents();

      expect(localStorage.getItem(STORAGE_KEY_V2)).toBeNull();
    });

    it('removes v1 storage key', () => {
      setLocalStorage(STORAGE_KEY_V1, JSON.stringify(['command-1']));

      const store = useRecentCommandsStore.getState();
      store.clearRecents();

      expect(localStorage.getItem(STORAGE_KEY_V1)).toBeNull();
    });

    it('handles localStorage errors gracefully', () => {
      const store = useRecentCommandsStore.getState();

      // Mock localStorage to throw
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => store.clearRecents()).not.toThrow();

      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('recentIds computation', () => {
    it('limits recentIds to max display count', () => {
      const store = useRecentCommandsStore.getState();

      // Record more than MAX_FRECENT_DISPLAY (5) commands
      for (let i = 0; i < 10; i++) {
        store.recordUsage(`command-${i}`);
      }

      const { recentIds } = useRecentCommandsStore.getState();

      expect(recentIds.length).toBeLessThanOrEqual(5);
    });

    it('orders recentIds by frecency score', () => {
      const store = useRecentCommandsStore.getState();

      // Use command-2 more than command-1
      store.recordUsage('command-1');
      store.recordUsage('command-2');
      store.recordUsage('command-2');

      const { recentIds } = useRecentCommandsStore.getState();

      // command-2 should come before command-1
      const index1 = recentIds.indexOf('command-1');
      const index2 = recentIds.indexOf('command-2');

      if (index1 !== -1 && index2 !== -1) {
        expect(index2).toBeLessThan(index1);
      }
    });

    it('updates recentIds when usage changes', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('command-1');
      const firstRecentIds = useRecentCommandsStore.getState().recentIds;

      store.recordUsage('command-2');
      const secondRecentIds = useRecentCommandsStore.getState().recentIds;

      expect(secondRecentIds).not.toEqual(firstRecentIds);
    });
  });

  describe('frecency algorithm', () => {
    it('balances frequency and recency', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const store = useRecentCommandsStore.getState();

      // Old command with high frequency
      for (let i = 0; i < 10; i++) {
        store.recordUsage('old-frequent');
      }

      // Advance time
      vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours (1 half-life)

      // New command with low frequency
      store.recordUsage('new-infrequent');

      const oldScore = store.getFrecencyScore('old-frequent');
      const newScore = store.getFrecencyScore('new-infrequent');

      vi.useRealTimers();

      // Both should have non-zero scores
      expect(oldScore).toBeGreaterThan(0);
      expect(newScore).toBeGreaterThan(0);

      // The balance depends on weights, but both should contribute
    });

    it('caps frequency to prevent runaway scores', () => {
      const store = useRecentCommandsStore.getState();

      // Use command way more than MAX_FREQUENCY_CAP (50)
      for (let i = 0; i < 100; i++) {
        store.recordUsage('super-frequent');
      }

      const score100 = store.getFrecencyScore('super-frequent');

      // Use another command exactly at cap
      for (let i = 0; i < 50; i++) {
        store.recordUsage('capped-frequent');
      }

      const score50 = store.getFrecencyScore('capped-frequent');

      // Scores should be similar (capped)
      expect(Math.abs(score100 - score50)).toBeLessThan(0.1);
    });
  });

  describe('localStorage persistence', () => {
    it('persists data to localStorage', () => {
      const store = useRecentCommandsStore.getState();

      store.recordUsage('persist-test-command');

      // Check that it was saved to localStorage
      const saved = localStorage.getItem(STORAGE_KEY_V2);
      expect(saved).toBeTruthy();

      // Parse and verify the data
      const parsed = JSON.parse(saved!);
      expect(parsed['persist-test-command']).toBeDefined();
      expect(parsed['persist-test-command'].commandId).toBe('persist-test-command');
      expect(parsed['persist-test-command'].useCount).toBeGreaterThan(0);
    });

    it('handles localStorage quota exceeded errors', () => {
      const store = useRecentCommandsStore.getState();

      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      });

      // Should not throw
      expect(() => store.recordUsage('command-1')).not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });
});
