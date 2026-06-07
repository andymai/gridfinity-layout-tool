import { useEffect, useRef, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '@/core/store/toast';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { getStagingBins } from '@/shared/utils/bins';
import { useLayoutStore } from '@/core/store/layout';
import {
  saveEphemeralState,
  loadEphemeralState,
  type EphemeralState,
} from '@/shared/utils/ephemeralState';
import { binId, layerId, categoryId } from '@/core/types';
import type { BinId } from '@/core/types';
import { useTranslation } from '@/i18n';
import { isSmokeMode } from '@/shared/utils/smokeMode';
import { runUpdateSmokeTest, type SmokeGateResult } from '@/shared/pwa/smokeGate';
import { checkBootVersionFreshness } from '@/shared/pwa/bootVersionCheck';
import { PRECACHE_PREFIX } from '@/shared/pwa/cacheNames';
import { getSmokeGateFlag } from '@/shared/pwa/featureFlag';
import { isIosStandalonePwa } from '@/shared/pwa/iosBypass';
import {
  startActivityTracking,
  isRecentlyActive,
  isEditableElementFocused,
  isModalOpen,
} from '@/shared/pwa/reloadSafety';
import { useSyncStatusStore } from '@/core/sync/status';
import { getPosthogInstance } from '@/shared/analytics/posthog/init';

/**
 * Module-level flag so the periodic checkForUpdate() doesn't fire a second
 * smoke run while one is already in flight. Reset by `gatedUpdate()` on exit.
 */
let smokeInProgress = false;

async function clearPrecaches(): Promise<void> {
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(PRECACHE_PREFIX)).map((k) => caches.delete(k))
    );
  } catch {
    // best-effort
  }
}

function captureSmokeEvent(name: string, props: Record<string, unknown>): void {
  try {
    getPosthogInstance()?.capture(name, props);
  } catch {
    // never let telemetry crash the gate
  }
}

// Toast duration for the brief "updating" notice shown right before reload
const UPDATE_TOAST_MS = 5000;

// Background polling interval (every 15 minutes when tab is active)
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Minimum time between update checks (1 minute)
const UPDATE_THROTTLE_MS = 60 * 1000;

// How often to check if safe to reload while waiting (1 second)
const IDLE_CHECK_INTERVAL_MS = 1000;

// How long to wait silently for an idle moment before surfacing the update
// prompt. Inside this window an update applies invisibly if the user pauses.
const SILENT_WINDOW_MS = 60 * 1000;

// Treat the user as actively present for this long after their last input.
const ACTIVITY_DEBOUNCE_MS = 30 * 1000;

// Safety net: auto-apply a still-pending update once the user has been
// continuously idle this long (or whenever they background the tab).
const LONG_IDLE_MS = 5 * 60 * 1000;

// Session storage key to prevent reload loops
const RELOAD_FLAG_KEY = 'pwa-update-pending-reload';

/**
 * Check if the app is in a state where it's safe to reload.
 * Avoids reloading during active user interactions or when they have unsaved work.
 */
function isSafeToReload(): boolean {
  const interaction = useInteractionStore.getState();
  const selection = useSelectionStore.getState();
  const view = useViewStore.getState();
  const layout = useLayoutStore.getState();

  // Don't reload during active interaction (drag, resize, draw, paint)
  if (interaction.interaction !== null) {
    return false;
  }

  // Don't reload with bins in staging (user might lose track of them)
  const stagedBins = getStagingBins(layout.layout.bins);
  if (stagedBins.length > 0) {
    return false;
  }

  // Don't reload during 3D preview (camera state would be lost)
  if (view.isPreviewExpanded) {
    return false;
  }

  // Don't reload with context menu open
  if (view.contextMenu !== null) {
    return false;
  }

  // Don't reload with quick label popover open
  if (selection.quickLabelBinId !== null) {
    return false;
  }

  // Don't reload during keyboard drag/resize mode
  if (interaction.keyboardDragMode || interaction.keyboardResizeMode) {
    return false;
  }

  // Don't reload while the user is typing in a text field (label/notes editing)
  if (isEditableElementFocused()) {
    return false;
  }

  // Don't reload with a modal/dialog open — in-progress form state would be lost
  if (isModalOpen()) {
    return false;
  }

  // Don't reload right after recent input — they're mid-task even without a
  // specific interaction flag set (e.g. moving the cursor, deciding).
  if (isRecentlyActive(ACTIVITY_DEBOUNCE_MS)) {
    return false;
  }

  // Don't reload while a layout sync is pushing changes to storage
  if (useSyncStatusStore.getState().state === 'syncing') {
    return false;
  }

  return true;
}

/**
 * Wait until the app is in a safe state to reload, with timeout.
 * Returns true if safe, false if timed out.
 * Supports cancellation via AbortSignal for proper cleanup on unmount.
 */
function waitForSafeReload(timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
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

type AutoApplyTrigger = 'idle' | 'hidden' | 'aborted';

/**
 * Wait for the safety-net condition that auto-applies a still-pending update
 * without an explicit click: either the tab is backgrounded while safe, or the
 * app has been continuously safe-to-reload for LONG_IDLE_MS. Either trigger
 * still respects every blocking signal — a hidden tab with an open modal or an
 * in-flight sync keeps waiting.
 */
function waitForAutoApply(signal: AbortSignal): Promise<AutoApplyTrigger> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve('aborted');
      return;
    }

    let safeSince: number | null = isSafeToReload() ? Date.now() : null;

    const cleanup = (): void => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', evaluate);
      signal.removeEventListener('abort', onAbort);
    };

    const evaluate = (): void => {
      if (signal.aborted) {
        cleanup();
        resolve('aborted');
        return;
      }
      if (!isSafeToReload()) {
        safeSince = null;
        return;
      }
      if (safeSince === null) safeSince = Date.now();
      if (document.hidden) {
        cleanup();
        resolve('hidden');
        return;
      }
      if (Date.now() - safeSince >= LONG_IDLE_MS) {
        cleanup();
        resolve('idle');
      }
    };

    const onAbort = (): void => {
      cleanup();
      resolve('aborted');
    };

    const intervalId = setInterval(evaluate, IDLE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', evaluate);
    signal.addEventListener('abort', onAbort);

    evaluate();
  });
}

/**
 * Gather current UI state for preservation across PWA reload.
 * Returns state suitable for saveEphemeralState().
 */
function gatherEphemeralState(): Omit<EphemeralState, 'savedAt'> {
  const selection = useSelectionStore.getState();
  const view = useViewStore.getState();
  const interaction = useInteractionStore.getState();

  return {
    // Selection & navigation
    selectedBinIds: selection.selectedBinIds,
    activeLayerId: selection.activeLayerId,
    activeCategoryId: selection.activeCategoryId,
    focusedBinId: selection.focusedBinId,

    // View settings
    zoom: view.zoom,
    showOtherLayers: view.showOtherLayers,

    // Panel state
    leftPanelCollapsed: view.leftPanelCollapsed,
    rightPanelCollapsed: view.rightPanelCollapsed,

    // 3D preview state
    showIsometricPreview: view.showIsometricPreview,
    isometricRotation: view.isometricRotation,
    layerViewMode: view.layerViewMode,

    paintSize: interaction.paintSize,

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

  const selection = useSelectionStore.getState();
  const view = useViewStore.getState();
  const interaction = useInteractionStore.getState();
  const layout = useLayoutStore.getState().layout;

  // Validate and restore activeLayerId
  const activeLayer = layerId(state.activeLayerId);
  const layerExists = layout.layers.some((l) => l.id === activeLayer);
  if (layerExists && state.activeLayerId) {
    selection.setActiveLayer(activeLayer);
  }

  // Validate and restore selected bins (filter out any that no longer exist)
  const existingBinIds = new Set<BinId>(layout.bins.map((b) => b.id));
  const validSelectedIds = state.selectedBinIds
    .map((id) => binId(id))
    .filter((id) => existingBinIds.has(id));
  if (validSelectedIds.length > 0) {
    selection.setSelectedBins(validSelectedIds);
  }

  // Restore active category (categories might have changed, but IDs are stable)
  const activeCategory = categoryId(state.activeCategoryId);
  const categoryExists = layout.categories.some((c) => c.id === activeCategory);
  if (categoryExists) {
    selection.setActiveCategory(activeCategory);
  }

  // Restore focused bin if it still exists
  if (state.focusedBinId && existingBinIds.has(binId(state.focusedBinId))) {
    selection.setFocusedBin(binId(state.focusedBinId));
  }

  // Restore view settings (these don't need validation)
  view.setZoom(state.zoom);

  // Restore toggles only if they differ from current state
  if (state.showOtherLayers !== view.showOtherLayers) {
    view.toggleShowOtherLayers();
  }
  // Restore panel state
  if (state.leftPanelCollapsed !== view.leftPanelCollapsed) {
    view.toggleLeftPanel();
  }
  if (state.rightPanelCollapsed !== view.rightPanelCollapsed) {
    view.toggleRightPanel();
  }

  // Restore 3D preview state
  if (state.showIsometricPreview !== view.showIsometricPreview) {
    view.toggleIsometricPreview();
  }
  view.setIsometricRotation(state.isometricRotation);
  view.setLayerViewMode(state.layerViewMode);

  // Restore paint size
  if (state.paintSize) {
    interaction.setPaintSize(state.paintSize);
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
 * When a new version is available it is applied without interrupting active
 * work (see the needRefresh effect): a brief silent window, then a persistent
 * click-to-update toast backed by a long-idle / tab-hidden safety net. It never
 * force-reloads while the user is mid-task.
 */
export function usePWAUpdate(): void {
  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
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

    // Skip if a smoke gate run is in flight — racing a second update detection
    // could SKIP_WAITING a different worker mid-iframe and corrupt the gate.
    if (smokeInProgress) return;

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

  // Smoke mode runs inside a hidden iframe and must NOT register a service worker —
  // doing so would re-trigger the update gate from inside the gate, and any SW the
  // iframe registered would persist beyond the smoke run.
  const skipRegistration = isSmokeMode();

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: !skipRegistration,
    onRegisteredSW(_swUrl, registration) {
      if (skipRegistration) return;
      // Store reference for update checks
      registrationRef.current = registration;

      // Clear reload flag on successful registration (update completed)
      try {
        sessionStorage.removeItem(RELOAD_FLAG_KEY);
      } catch {
        // best-effort
      }

      // Check immediately on registration (page load)
      void checkForUpdate();

      // Set up periodic checks (less aggressive - every 15 minutes)
      intervalRef.current = window.setInterval(() => {
        void checkForUpdate();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      if (skipRegistration) return;
      console.error('SW registration failed:', error);

      // App still works without SW, but offline features won't be available
      // Only warn if it seems like a persistent issue
      if (error.message.includes('SecurityError')) {
        console.warn('SW blocked - may be in private browsing or SW disabled');
      }
    },
  });

  // Listen for online/offline transitions
  useEffect(() => {
    if (skipRegistration) return;

    const handleOnline = () => {
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        addToast(t('toast.online'), 'success');
        // Check for updates when coming back online
        void checkForUpdate();
      }
    };

    const handleOffline = () => {
      if (!wasOfflineRef.current) {
        wasOfflineRef.current = true;
        addToast(t('toast.offline'), 'info');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, checkForUpdate, t, skipRegistration]);

  // Set up visibility listener for update checks (not focus - fires too often)
  useEffect(() => {
    if (skipRegistration) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForUpdate, skipRegistration]);

  // Track user input so isSafeToReload() can defer while they're actively using
  // the app (see ACTIVITY_DEBOUNCE_MS).
  useEffect(() => {
    if (skipRegistration) return;
    return startActivityTracking();
  }, [skipRegistration]);

  // Boot freshness check: the SW can serve a stale precached shell, so the
  // running bundle may be behind the live deploy. Compare /version.json's gitSha
  // to this build's and self-heal before the user hits a load failure. One-shot
  // per session (recoverStaleBundle is guarded), complements the SW polling.
  useEffect(() => {
    if (skipRegistration) return;
    void checkBootVersionFreshness();
  }, [skipRegistration]);

  // Apply an available update without interrupting active work.
  //
  // The smoke gate (when enabled via PostHog flag) runs first: it activates the
  // new SW manually, spawns a hidden iframe to verify the new bundle boots, and
  // either green-lights the reload or rolls back the precache.
  //
  // The reload itself is hybrid:
  //   1. Wait up to SILENT_WINDOW_MS for an idle moment and reload quietly.
  //   2. If the user is still active, surface a persistent "Update available"
  //      toast they can act on, while a safety net auto-applies once they go
  //      idle (LONG_IDLE_MS) or background the tab. We never force a reload
  //      out from under an active session.
  useEffect(() => {
    if (!needRefresh || hasTriggeredReload.current) return;

    // Check if we already tried to reload (prevent loops)
    try {
      if (sessionStorage.getItem(RELOAD_FLAG_KEY)) {
        console.warn('Reload loop detected, skipping auto-reload');
        return;
      }
    } catch {
      // best-effort
    }

    hasTriggeredReload.current = true;

    // Use AbortController for cleanup on unmount
    const abortController = new AbortController();
    const { signal } = abortController;
    let reloaded = false;

    // Apply the update now: persist UI state, then SKIP_WAITING + reload. Shared
    // by the silent path, the long-idle/hidden safety net, and the explicit
    // toast click — the click deliberately bypasses isSafeToReload(), since
    // clicking "Reload" is unambiguous intent that overrides the blocking checks.
    const performReload = (): void => {
      if (reloaded || signal.aborted) return;
      reloaded = true;

      try {
        sessionStorage.setItem(RELOAD_FLAG_KEY, Date.now().toString());
      } catch {
        // best-effort
      }

      // Save UI state right before reload (after smoke success in the gated path,
      // so we never leave stale ephemeral state behind a failed gate run).
      saveEphemeralState(gatherEphemeralState());

      addToast(t('toast.updating'), 'info', UPDATE_TOAST_MS);

      // updateServiceWorker(true) sends SKIP_WAITING + reloads. In the gated
      // path the new SW is already 'activated', so SKIP_WAITING is a no-op
      // and only the reload runs.
      void updateServiceWorker(true);
    };

    const gatedUpdate = async (): Promise<void> => {
      const registration = registrationRef.current;
      const flagEnabled = await getSmokeGateFlag();
      const useGate = flagEnabled && !isIosStandalonePwa() && Boolean(registration?.waiting);

      if (useGate && registration) {
        smokeInProgress = true;
        let result: SmokeGateResult;
        try {
          result = await runUpdateSmokeTest(registration);
        } finally {
          smokeInProgress = false;
        }

        if (signal.aborted) return;

        if (!result.ok) {
          captureSmokeEvent('pwa_smoke_failed', {
            reason: result.reason,
            from_version: __APP_VERSION__,
            to_version: result.version,
            expected_version: result.expectedVersion,
            duration_ms: result.durationMs,
            retries: result.retries,
            ua: navigator.userAgent,
            // matchMedia is virtually always available in real browsers, but
            // guard so a missing implementation can't take out the cleanup.
            is_pwa_installed:
              typeof window.matchMedia === 'function' &&
              window.matchMedia('(display-mode: standalone)').matches,
            is_offline: !navigator.onLine,
            has_active_interaction: useInteractionStore.getState().interaction !== null,
          });
          // Drop the new SW + its precache. Existing tab keeps its in-memory bundle;
          // next reload will fetch from network without a SW until a fix re-deploys.
          await clearPrecaches();
          try {
            await registration.unregister();
          } catch {
            // best-effort
          }
          // Allow a future update attempt (don't leave RELOAD_FLAG_KEY set since
          // we never actually reloaded).
          hasTriggeredReload.current = false;
          return;
        }

        captureSmokeEvent('pwa_smoke_passed', {
          from_version: __APP_VERSION__,
          to_version: result.version,
          duration_ms: result.durationMs,
          retries: result.retries,
        });
      }

      // Re-check abort: getSmokeGateFlag can take up to 2s, plenty of time
      // for the component to unmount.
      if (signal.aborted) return;

      // Phase 1 — apply silently if the user goes idle within the short window.
      const wentIdle = await waitForSafeReload(SILENT_WINDOW_MS, signal);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- signal can flip between awaits
      if (signal.aborted) return;
      if (wentIdle) {
        performReload();
        return;
      }

      // Phase 2 — still active: surface a persistent prompt and keep a safety
      // net running. Dismissing the toast leaves the update pending (no re-nag);
      // the net still applies it on long idle or when the tab is backgrounded.
      addToast({
        message: t('toast.updateAvailable'),
        type: 'info',
        duration: 0,
        action: { label: t('toast.updateReload'), onClick: performReload },
      });

      // waitForAutoApply resolves 'aborted' on unmount; performReload also
      // guards on signal.aborted, so no second check is needed here.
      const trigger = await waitForAutoApply(signal);
      if (trigger === 'aborted') return;
      performReload();
    };

    void gatedUpdate();

    return () => {
      abortController.abort();
    };
  }, [needRefresh, addToast, updateServiceWorker, t]);

  // Restore ephemeral state on mount (after PWA update reload)
  useEffect(() => {
    if (skipRegistration) return;
    // Small delay to ensure layout store is initialized
    const timeoutId = setTimeout(() => {
      const restored = restoreEphemeralState();
      if (restored) {
        addToast(t('toast.sessionRestored'), 'success', 2000);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [addToast, t, skipRegistration]);
}
