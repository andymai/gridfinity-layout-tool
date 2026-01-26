/**
 * Store for tracking recently used commands in the command palette.
 * Persists to localStorage for cross-session continuity.
 */

import { create } from 'zustand';

const STORAGE_KEY = 'gridfinity-command-palette-recents-v1';
const MAX_RECENTS = 5;

interface RecentCommandsState {
  recentIds: string[];
  recordUsage: (commandId: string) => void;
  clearRecents: () => void;
}

function loadRecents(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_RECENTS);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveRecents(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

export const useRecentCommandsStore = create<RecentCommandsState>()((set, get) => ({
  recentIds: loadRecents(),

  recordUsage: (commandId: string) => {
    const { recentIds } = get();
    // Remove if already present, then add to front
    const filtered = recentIds.filter((id) => id !== commandId);
    const updated = [commandId, ...filtered].slice(0, MAX_RECENTS);
    saveRecents(updated);
    set({ recentIds: updated });
  },

  clearRecents: () => {
    saveRecents([]);
    set({ recentIds: [] });
  },
}));
