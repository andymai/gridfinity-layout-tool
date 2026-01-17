/**
 * Ephemeral state preservation for PWA updates.
 *
 * Saves UI state to sessionStorage before a PWA-triggered reload,
 * then restores it afterward so the user's context is preserved.
 * Uses sessionStorage (not localStorage) so state doesn't persist
 * across browser restarts - only across PWA update reloads.
 */

import type { LayerViewMode, PaintSize } from '../core/store/ui';

const EPHEMERAL_STATE_KEY = 'gridfinity-ephemeral-state-v1';

/**
 * UI state that should be preserved across PWA updates.
 * Excludes transient state like active interactions, context menus,
 * modals, and hover highlights.
 */
export interface EphemeralState {
  // Selection & navigation
  selectedBinIds: string[];
  activeLayerId: string;
  activeCategoryId: string;
  focusedBinId: string | null;

  // View settings
  zoom: number;
  showOtherLayers: boolean;
  showLabels: boolean;

  // Panel state
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;

  // 3D preview state
  showIsometricPreview: boolean;
  isometricRotation: number;
  layerViewMode: LayerViewMode;

  // Paint mode (user might want to keep their brush size)
  paintSize: PaintSize | null;

  // Grid scroll position (optional - requires coordination with Grid component)
  scrollPosition?: { x: number; y: number };

  // Timestamp for debugging/validation
  savedAt: number;
}

/**
 * Save ephemeral UI state to sessionStorage.
 * Called before PWA update triggers a reload.
 */
export function saveEphemeralState(state: Omit<EphemeralState, 'savedAt'>): void {
  try {
    const stateWithTimestamp: EphemeralState = {
      ...state,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(EPHEMERAL_STATE_KEY, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    // Silently fail - state preservation is nice-to-have, not critical
    console.warn('Failed to save ephemeral state:', error);
  }
}

/**
 * Load and clear ephemeral state from sessionStorage.
 * Returns null if no state exists or if it's stale (> 30 seconds old).
 * Automatically clears the stored state after reading.
 */
export function loadEphemeralState(): EphemeralState | null {
  try {
    const stored = sessionStorage.getItem(EPHEMERAL_STATE_KEY);
    if (!stored) return null;

    // Always clear after reading - one-time use
    sessionStorage.removeItem(EPHEMERAL_STATE_KEY);

    const state = JSON.parse(stored) as EphemeralState;

    // Validate timestamp - reject if older than 30 seconds
    // This prevents restoring stale state from an old session
    const MAX_AGE_MS = 30 * 1000;
    if (Date.now() - state.savedAt > MAX_AGE_MS) {
      console.warn('Ephemeral state too old, discarding');
      return null;
    }

    // Basic validation - ensure required fields exist
    if (
      !Array.isArray(state.selectedBinIds) ||
      typeof state.activeLayerId !== 'string' ||
      typeof state.zoom !== 'number'
    ) {
      console.warn('Ephemeral state validation failed, discarding');
      return null;
    }

    return state;
  } catch (error) {
    // Clear potentially corrupted data
    try {
      sessionStorage.removeItem(EPHEMERAL_STATE_KEY);
    } catch {
      // Ignore
    }
    console.warn('Failed to load ephemeral state:', error);
    return null;
  }
}

/**
 * Check if there's pending ephemeral state to restore.
 * Useful for showing a brief "Restored your session" indicator.
 */
export function hasEphemeralState(): boolean {
  try {
    return sessionStorage.getItem(EPHEMERAL_STATE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Clear any pending ephemeral state without restoring it.
 */
export function clearEphemeralState(): void {
  try {
    sessionStorage.removeItem(EPHEMERAL_STATE_KEY);
  } catch {
    // Ignore
  }
}
