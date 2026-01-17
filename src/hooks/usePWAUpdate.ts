import { useEffect, useRef, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '../core/store/toast';
import { useUIStore } from '../core/store/ui';
import { STAGING_ID } from '../core/constants';
import { useLayoutStore } from '../core/store/layout';
import {
  saveEphemeralState,
  loadEphemeralState,
  type EphemeralState,
} from '../utils/ephemeralState';

// Toast duration for update notification
const UPDATE_TOAST_MS = 5000;

// Background polling interval (every 15 minutes when tab is active)
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Minimum time between update checks (1 minute)
const UPDATE_THROTTLE_MS = 60 * 1000;

// How often to check if safe to reload while waiting (1 second)
const IDLE_CHECK_INTERVAL_MS = 1000;

// Max time to wait for idle before forcing reload (2 minutes)
const MAX_IDLE_WAIT_MS = 2 * 60 * 1000;

// Session storage key to prevent reload loops
const RELOAD_FLAG_KEY = 'pwa-update-pending-reload';

/**
 * Check if the app is in a state where it's safe to reload.
 * Avoids reloading during active user interactions or when they have unsaved work.
 */
function isSafeToReload(): boolean {
  const ui = useUIStore.getState();
  const layout = useLayoutStore.getState();

  // Don't reload during active interaction (drag, resize, draw, paint)
  if (ui.interaction !== null) {
    return false;
  }

  // Don't reload with bins in staging (user might lose track of them)
  const stagedBins = layout.layout.bins.filter(b => b.layerId === STAGING_ID);
  if (stagedBins.length > 0) {
    return false;
  }

  // Don't reload during 3D preview (camera state would be lost)
  if (ui.isPreviewExpanded) {
    return false;
  }

  // Don't reload with context menu open
  if (ui.contextMenu !== null) {
    return false;
  }

  // Don't reload with quick label popover open
  if (ui.quickLabelBinId !== null) {
    return false;
  }

  // Don't reload during keyboard drag/resize mode
  if (ui.keyboardDragMode || ui.keyboardResizeMode) {
    return false;
  }

  return true;
}

/**
 * Wait until the app is in a safe state to reload, with timeout.
 * Returns true if safe, false if timed out.
 * Supports cancellation via AbortSignal for proper cleanup on unmount.
 */
function waitForSafeReload(
  timeoutMs: number,
  signal?: AbortSignal
): Promise<boolean> {
  return new Promise((resolve) => {
    // Check immediately - if already safe, resolve without starting interval
    if (isSafeToReload()) {
      resolve(true);
      return;
    }

    // Check for already-aborted signal
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    const startTime = Date.now();

    const intervalId = setInterval(() => {
      if (signal?.aborted) {
        clearInterval(intervalId);
        resolve(false);
        return;
      }

      if (isSafeToReload()) {
        clearInterval(intervalId);
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        // Timed out waiting for idle - reload anyway
        clearInterval(intervalId);
        resolve(false);
      }
    }, IDLE_CHECK_INTERVAL_MS);

    // Clean up interval if signal is aborted
    signal?.addEventListener('abort', () => {
      clearInterval(intervalId);
      resolve(false);
    });
  });
}

/**
 * Gather current UI state for preservation across PWA reload.
 * Returns state suitable for saveEphemeralState().
 */
function gatherEphemeralState(): Omit<EphemeralState, 'savedAt'> {
  const ui = useUIStore.getState();

  return {
    // Selection & navigation
    selectedBinIds: ui.selectedBinIds,
    activeLayerId: ui.activeLayerId,
    activeCategoryId: ui.activeCategoryId,
    focusedBinId: ui.focusedBinId,

    // View settings
    zoom: ui.zoom,
    showOtherLayers: ui.showOtherLayers,
    showLabels: ui.showLabels,

    // Panel state
    leftPanelCollapsed: ui.leftPanelCollapsed,
    rightPanelCollapsed: ui.rightPanelCollapsed,

    // 3D preview state
    showIsometricPreview: ui.showIsometricPreview,
    isometricRotation: ui.isometricRotation,
    layerViewMode: ui.layerViewMode,

    // Paint mode
    paintSize: ui.paintSize,

    // Note: scroll position would require ref from Grid component
    // Could be added via a global ref or event-based approach
  };
}

/**
 * Restore UI state from ephemeral storage after PWA reload.
 * Validates that bins/layers still exist before restoring selection.
 */
function restoreEphemeralState(): boolean {
  const state = loadEphemeralState();
  if (!state) return false;

  const ui = useUIStore.getState();
  const layout = useLayoutStore.getState().layout;

  // Validate and restore activeLayerId
  const layerExists = layout.layers.some((l) => l.id === state.activeLayerId);
  if (layerExists && state.activeLayerId) {
    ui.setActiveLayer(state.activeLayerId);
  }

  // Validate and restore selected bins (filter out any that no longer exist)
  const existingBinIds = new Set(layout.bins.map((b) => b.id));
  const validSelectedIds = state.selectedBinIds.filter((id) =>
    existingBinIds.has(id)
  );
  if (validSelectedIds.length > 0) {
    ui.setSelectedBins(validSelectedIds);
  }

  // Restore active category (categories might have changed, but IDs are stable)
  const categoryExists = layout.categories.some(
    (c) => c.id === state.activeCategoryId
  );
  if (categoryExists) {
    ui.setActiveCategory(state.activeCategoryId);
  }

  // Restore focused bin if it still exists
  if (state.focusedBinId && existingBinIds.has(state.focusedBinId)) {
    ui.setFocusedBin(state.focusedBinId);
  }

  // Restore view settings (these don't need validation)
  ui.setZoom(state.zoom);

  // Restore toggles only if they differ from current state
  if (state.showOtherLayers !== ui.showOtherLayers) {
    ui.toggleShowOtherLayers();
  }
  if (state.showLabels !== ui.showLabels) {
    ui.toggleShowLabels();
  }

  // Restore panel state
  if (state.leftPanelCollapsed !== ui.leftPanelCollapsed) {
    ui.toggleLeftPanel();
  }
  if (state.rightPanelCollapsed !== ui.rightPanelCollapsed) {
    ui.toggleRightPanel();
  }

  // Restore 3D preview state
  if (state.showIsometricPreview !== ui.showIsometricPreview) {
    ui.toggleIsometricPreview();
  }
  ui.setIsometricRotation(state.isometricRotation);
  ui.setLayerViewMode(state.layerViewMode);

  // Restore paint size
  if (state.paintSize) {
    ui.setPaintSize(state.paintSize);
  }

  return true;
}

/**
 * Hook that handles PWA service worker updates.
 *
 * Checks for updates on:
 * - Initial page load (via onRegisteredSW callback)
 * - Tab visibility change (returning to tab)
 * - Every 15 minutes while active
 *
 * Update checks are throttled and skip when:
 * - Offline (navigator.onLine is false)
 * - SW is currently installing
 * - Checked within last minute
 *
 * When a new version is available:
 * - Waits until user is idle (no active interaction, no staging bins)
 * - Shows a toast notification
 * - Auto-reloads after a short delay
 */
export function usePWAUpdate(): void {
  const addToast = useToastStore(state => state.addToast);
  const hasTriggeredReload = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);
  const lastCheckRef = useRef<number>(0);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const wasOfflineRef = useRef(!navigator.onLine);

  /**
   * Check for SW updates.
   * Uses registration.update() which already fetches SW with cache bypass per spec.
   */
  const checkForUpdate = useCallback(async () => {
    const registration = registrationRef.current;

    // Skip if not registered yet
    if (!registration) return;

    // Skip if SW is currently installing
    if (registration.installing) return;

    // Skip if offline
    if (!navigator.onLine) return;

    // Throttle checks
    const now = Date.now();
    if (now - lastCheckRef.current < UPDATE_THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      await registration.update();
    } catch (error) {
      // Silently handle network errors during update check
      console.warn('SW update check failed:', error);
    }
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Store reference for update checks
      registrationRef.current = registration;

      // Clear reload flag on successful registration (update completed)
      try {
        sessionStorage.removeItem(RELOAD_FLAG_KEY);
      } catch {
        // Ignore storage errors
      }

      // Check immediately on registration (page load)
      checkForUpdate();

      // Set up periodic checks (less aggressive - every 15 minutes)
      intervalRef.current = window.setInterval(() => {
        checkForUpdate();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.error('SW registration failed:', error);

      // App still works without SW, but offline features won't be available
      // Only warn if it seems like a persistent issue
      if (error?.message?.includes('SecurityError')) {
        console.warn('SW blocked - may be in private browsing or SW disabled');
      }
    },
  });

  // Listen for online/offline transitions
  useEffect(() => {
    const handleOnline = () => {
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        addToast('Back online', 'success');
        // Check for updates when coming back online
        checkForUpdate();
      }
    };

    const handleOffline = () => {
      if (!wasOfflineRef.current) {
        wasOfflineRef.current = true;
        addToast('You\'re offline. Changes save locally.', 'info');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, checkForUpdate]);

  // Set up visibility listener for update checks (not focus - fires too often)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForUpdate]);

  // Handle update notification and auto-reload when idle
  useEffect(() => {
    if (!needRefresh || hasTriggeredReload.current) return;

    // Check if we already tried to reload (prevent loops)
    try {
      if (sessionStorage.getItem(RELOAD_FLAG_KEY)) {
        console.warn('Reload loop detected, skipping auto-reload');
        return;
      }
    } catch {
      // Ignore storage errors
    }

    hasTriggeredReload.current = true;

    // Set flag before attempting reload
    try {
      sessionStorage.setItem(RELOAD_FLAG_KEY, Date.now().toString());
    } catch {
      // Ignore storage errors
    }

    // Use AbortController for cleanup on unmount
    const abortController = new AbortController();
    let toastTimeoutId: number | undefined;

    // Wait for safe state before reloading
    const performUpdate = async () => {
      const wasSafe = await waitForSafeReload(MAX_IDLE_WAIT_MS, abortController.signal);

      // Don't proceed if aborted during wait
      if (abortController.signal.aborted) return;

      if (!wasSafe) {
        console.warn('Timed out waiting for idle, proceeding with update');
      }

      // Show toast notification
      addToast('Updating to latest version...', 'info', UPDATE_TOAST_MS);

      // Brief delay to let user see the toast (cancellable)
      await new Promise<void>((resolve) => {
        if (abortController.signal.aborted) {
          resolve();
          return;
        }
        toastTimeoutId = window.setTimeout(resolve, UPDATE_TOAST_MS);
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(toastTimeoutId);
          resolve();
        });
      });

      // Don't trigger reload if aborted
      if (abortController.signal.aborted) return;

      // Save current UI state before reload so we can restore it
      saveEphemeralState(gatherEphemeralState());

      // Trigger the update (reloads the page)
      updateServiceWorker(true);
    };

    performUpdate();

    return () => {
      abortController.abort();
      if (toastTimeoutId !== undefined) {
        clearTimeout(toastTimeoutId);
      }
    };
  }, [needRefresh, addToast, updateServiceWorker]);

  // Restore ephemeral state on mount (after PWA update reload)
  useEffect(() => {
    // Small delay to ensure layout store is initialized
    const timeoutId = setTimeout(() => {
      const restored = restoreEphemeralState();
      if (restored) {
        addToast('Session restored', 'success', 2000);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
