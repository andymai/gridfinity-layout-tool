/**
 * Store for tracking command usage with frecency scoring.
 * Frecency = frequency + recency (like Firefox's URL bar algorithm).
 * Persists to localStorage for cross-session continuity.
 */

import { create } from 'zustand';

const STORAGE_KEY_V2 = 'gridfinity-command-palette-frecency-v2';
const STORAGE_KEY_V1 = 'gridfinity-command-palette-recents-v1';
const MAX_FRECENT_DISPLAY = 5;

/** Frecency algorithm configuration */
const FRECENCY_CONFIG = {
  /** Weight for frequency component (0-1) */
  FREQUENCY_WEIGHT: 0.4,
  /** Weight for recency component (0-1) */
  RECENCY_WEIGHT: 0.6,
  /** Half-life for recency decay in hours */
  RECENCY_HALF_LIFE_HOURS: 24,
  /** Maximum frequency count to consider (prevents runaway scores) */
  MAX_FREQUENCY_CAP: 50,
  /** Minimum score threshold to appear in frecent list */
  MIN_SCORE_THRESHOLD: 0.01,
} as const;

interface CommandUsage {
  /** Command ID */
  commandId: string;
  /** Number of times this command has been used */
  useCount: number;
  /** Unix timestamp of last use (ms) */
  lastUsedAt: number;
}

interface FrecencyState {
  /** Map of command usage data */
  usage: Record<string, CommandUsage>;
  /** Computed recent IDs for backward compatibility */
  recentIds: string[];
  /** Record a command use */
  recordUsage: (commandId: string) => void;
  /** Get frecency score for a command (0-1 range) */
  getFrecencyScore: (commandId: string) => number;
  /** Get command IDs sorted by frecency (highest first) */
  getSortedByFrecency: (commandIds: string[]) => string[];
  /** Clear all frecency data */
  clearRecents: () => void;
}

/**
 * Calculate frecency score for a command usage record.
 * Combines frequency (log scale) and recency (exponential decay).
 */
function calculateFrecencyScore(usage: CommandUsage | undefined): number {
  if (!usage) return 0;

  const { useCount, lastUsedAt } = usage;
  const now = Date.now();

  // Frequency component: logarithmic scale, capped
  const cappedCount = Math.min(useCount, FRECENCY_CONFIG.MAX_FREQUENCY_CAP);
  const frequencyScore =
    Math.log10(cappedCount + 1) / Math.log10(FRECENCY_CONFIG.MAX_FREQUENCY_CAP + 1);

  // Recency component: exponential decay
  const hoursSinceUse = (now - lastUsedAt) / (1000 * 60 * 60);
  const recencyScore = Math.pow(0.5, hoursSinceUse / FRECENCY_CONFIG.RECENCY_HALF_LIFE_HOURS);

  // Combined score
  return (
    FRECENCY_CONFIG.FREQUENCY_WEIGHT * frequencyScore +
    FRECENCY_CONFIG.RECENCY_WEIGHT * recencyScore
  );
}

/**
 * Load frecency data from localStorage, with migration from v1 format.
 */
/**
 * Validate that a value is a valid CommandUsage object.
 */
function isValidCommandUsage(value: unknown): value is CommandUsage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CommandUsage).commandId === 'string' &&
    typeof (value as CommandUsage).useCount === 'number' &&
    typeof (value as CommandUsage).lastUsedAt === 'number'
  );
}

function loadFrecencyData(): Record<string, CommandUsage> {
  try {
    // Try new v2 format first
    const v2Data = localStorage.getItem(STORAGE_KEY_V2);
    if (v2Data) {
      const parsed = JSON.parse(v2Data);
      // Validate it's a plain object (not array) with valid entries
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const validated: Record<string, CommandUsage> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (isValidCommandUsage(value)) {
            validated[key] = value;
          }
        }
        return validated;
      }
    }

    // Migrate from v1 format (simple array of IDs)
    const v1Data = localStorage.getItem(STORAGE_KEY_V1);
    if (v1Data) {
      const recentIds: string[] = JSON.parse(v1Data);
      if (Array.isArray(recentIds)) {
        const now = Date.now();
        const migrated: Record<string, CommandUsage> = {};

        // Assign decreasing recency based on position
        recentIds.forEach((id, index) => {
          migrated[id] = {
            commandId: id,
            useCount: 1,
            lastUsedAt: now - index * 60000, // Stagger by 1 minute each
          };
        });

        // Clean up old storage after migration
        localStorage.removeItem(STORAGE_KEY_V1);

        // Save in new format
        saveFrecencyData(migrated);

        return migrated;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Save frecency data to localStorage.
 */
function saveFrecencyData(usage: Record<string, CommandUsage>): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(usage));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Compute the top N recent command IDs from usage data.
 * Pre-computes scores to avoid redundant calculations during sort.
 */
function computeRecentIds(usage: Record<string, CommandUsage>): string[] {
  return Object.values(usage)
    .map((u) => ({ usage: u, score: calculateFrecencyScore(u) }))
    .filter((item) => item.score >= FRECENCY_CONFIG.MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FRECENT_DISPLAY)
    .map((item) => item.usage.commandId);
}

export const useRecentCommandsStore = create<FrecencyState>()((set, get) => {
  const initialUsage = loadFrecencyData();

  return {
    usage: initialUsage,
    recentIds: computeRecentIds(initialUsage),

    recordUsage: (commandId: string) => {
      const { usage } = get();
      const existing = usage[commandId];
      const now = Date.now();

      const updated: Record<string, CommandUsage> = {
        ...usage,
        [commandId]: {
          commandId,
          useCount: (existing?.useCount ?? 0) + 1,
          lastUsedAt: now,
        },
      };

      saveFrecencyData(updated);
      set({
        usage: updated,
        recentIds: computeRecentIds(updated),
      });
    },

    getFrecencyScore: (commandId: string) => {
      const { usage } = get();
      return calculateFrecencyScore(usage[commandId]);
    },

    getSortedByFrecency: (commandIds: string[]) => {
      const { usage } = get();
      return commandIds
        .map((id) => ({
          id,
          score: calculateFrecencyScore(usage[id]),
        }))
        .filter((item) => item.score >= FRECENCY_CONFIG.MIN_SCORE_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.id);
    },

    clearRecents: () => {
      try {
        localStorage.removeItem(STORAGE_KEY_V2);
        localStorage.removeItem(STORAGE_KEY_V1);
      } catch {
        // Ignore storage errors
      }
      set({ usage: {}, recentIds: [] });
    },
  };
});

// Re-export for backward compatibility
export type { FrecencyState as RecentCommandsState };
