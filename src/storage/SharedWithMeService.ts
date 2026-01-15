/**
 * Shared With Me Service - storage for layouts shared by other users.
 *
 * This module handles persistence for the "Shared with me" list - layouts
 * that other users have shared with you via cloud share links.
 *
 * Storage key: gridfinity-shared-with-me-v1
 */

import type { SharedWithMeEntry } from '../types';

const SHARED_WITH_ME_KEY = 'gridfinity-shared-with-me-v1';

interface SharedWithMeIndex {
  version: '1.0';
  entries: SharedWithMeEntry[];
}

/**
 * Save shared-with-me entries to localStorage.
 */
export function saveSharedWithMe(entries: SharedWithMeEntry[]): void {
  try {
    const data: SharedWithMeIndex = {
      version: '1.0',
      entries,
    };
    localStorage.setItem(SHARED_WITH_ME_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save shared-with-me entries:', error);
  }
}

/**
 * Load shared-with-me entries from localStorage.
 */
export function loadSharedWithMe(): SharedWithMeEntry[] {
  try {
    const raw = localStorage.getItem(SHARED_WITH_ME_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw) as SharedWithMeIndex;

    // Validate structure
    if (!data.entries || !Array.isArray(data.entries)) {
      return [];
    }

    return data.entries;
  } catch (error) {
    console.error('Failed to load shared-with-me entries:', error);
    return [];
  }
}

/**
 * Clear all shared-with-me entries from localStorage.
 */
export function clearSharedWithMe(): void {
  try {
    localStorage.removeItem(SHARED_WITH_ME_KEY);
  } catch (error) {
    console.error('Failed to clear shared-with-me entries:', error);
  }
}
