/**
 * Collection Sync Hook
 *
 * Manages real-time synchronization for shared collections:
 * - Polls for changes every 30 seconds (when tab is visible)
 * - Sends heartbeats while actively editing
 * - Detects conflicts and emits events for resolution
 * - Tracks sync status for UI feedback
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../store/collection';
import { useLayoutStore } from '../store/layout';
import * as collectionApi from '../api/collection';
import { generateUUID } from '../utils/uuid';

// ============================================================================
// Constants
// ============================================================================

/** Poll interval when tab is visible (30 seconds) */
const POLL_INTERVAL_MS = 30_000;

/** Heartbeat interval while editing (10 seconds) */
const HEARTBEAT_INTERVAL_MS = 10_000;

/** Debounce delay for auto-push (2.5 seconds after last change) */
const PUSH_DEBOUNCE_MS = 2_500;

/** Storage key for persistent device ID */
const DEVICE_ID_KEY = 'gridfinity-device-id';

// ============================================================================
// Types
// ============================================================================

export type SyncStatus =
  | 'idle'       // Not syncing
  | 'syncing'    // Push or pull in progress
  | 'synced'     // All changes saved
  | 'offline'    // Offline, changes queued
  | 'conflict'   // Conflict detected
  | 'error';     // Sync error

export interface ConflictInfo {
  layoutId: string;
  layoutName: string;
  serverModifiedAt: number;
}

export interface CollectionSyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  conflict: ConflictInfo | null;
  activeEditors: Map<string, number>;  // layoutId -> count
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get or create a persistent device ID.
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ============================================================================
// Hook
// ============================================================================

export function useCollectionSync() {
  const [syncState, setSyncState] = useState<CollectionSyncState>({
    status: 'idle',
    lastSyncAt: null,
    conflict: null,
    activeEditors: new Map(),
  });

  const {
    activeCollection,
    activeCollectionLayouts,
    syncStates,
    hasLocalChanges,
    markLayoutModified,
    clearLocalModification,
    setSyncState: setStoreSyncState,
    updateActiveCollectionLayout,
  } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      activeCollectionLayouts: state.activeCollectionLayouts,
      syncStates: state.syncStates,
      hasLocalChanges: state.hasLocalChanges,
      markLayoutModified: state.markLayoutModified,
      clearLocalModification: state.clearLocalModification,
      setSyncState: state.setSyncState,
      updateActiveCollectionLayout: state.updateActiveCollectionLayout,
    }))
  );

  const layout = useLayoutStore((state) => state.layout);
  const activeLayoutId = useLayoutStore((state) => state.activeLayoutId);
  const importLayout = useLayoutStore((state) => state.importLayout);

  // Refs for intervals
  const pollIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const pushTimeoutRef = useRef<number | null>(null);
  const lastPollModifiedAt = useRef<number | null>(null);
  const deviceIdRef = useRef<string>(getDeviceId());

  // Track if we're currently editing
  const isEditingRef = useRef(false);

  // Ref to track if this is the initial mount (to skip triggering on first render)
  const isInitialMount = useRef(true);
  // Ref to track the previous layout ID (to skip triggering when switching layouts)
  const prevLayoutIdRef = useRef<string | null>(null);

  /**
   * Poll for changes from server.
   */
  const poll = useCallback(async () => {
    if (!activeCollection) return;

    try {
      const result = await collectionApi.pollCollection(
        activeCollection.id,
        lastPollModifiedAt.current ?? undefined
      );

      // Not modified
      if (collectionApi.isPollNotModified(result)) {
        setSyncState((prev) => ({
          ...prev,
          status: 'synced',
          lastSyncAt: Date.now(),
        }));
        return;
      }

      // Error
      if (!result.success) {
        if (result.error.code === 'NETWORK_ERROR') {
          setSyncState((prev) => ({ ...prev, status: 'offline' }));
        } else {
          setSyncState((prev) => ({ ...prev, status: 'error' }));
        }
        return;
      }

      // Update last modified timestamp for next poll
      lastPollModifiedAt.current = result.data.modifiedAt;

      // Update active editor counts
      const editors = new Map<string, number>();
      for (const layout of result.data.layouts) {
        if (layout.activeEditors > 0) {
          editors.set(layout.id, layout.activeEditors);
        }
      }

      // Check for changes
      const serverLayouts = result.data.layouts;
      const localLayoutIds = new Set(activeCollectionLayouts.map((l) => l.id));
      const serverLayoutIds = new Set(serverLayouts.map((l) => l.id));

      // Detect deleted layouts (on server but not local)
      for (const localId of localLayoutIds) {
        if (!serverLayoutIds.has(localId)) {
          // Layout was deleted on server
          // TODO: Handle deleted layout notification
        }
      }

      // Detect new layouts (on server but not local)
      for (const serverLayout of serverLayouts) {
        if (!localLayoutIds.has(serverLayout.id)) {
          // New layout from server - update collection layouts
          // Note: Full layout data needs to be fetched separately
        }
      }

      // Check for conflicts on layouts we've modified
      for (const serverLayout of serverLayouts) {
        const localSyncState = syncStates[serverLayout.id];
        if (!localSyncState) continue;

        const hasLocalMods = hasLocalChanges(serverLayout.id);
        const serverIsNewer = serverLayout.modifiedAt > localSyncState.modifiedAt;

        if (hasLocalMods && serverIsNewer) {
          // Conflict detected
          const layoutInfo = activeCollectionLayouts.find(
            (l) => l.id === serverLayout.id
          );
          setSyncState((prev) => ({
            ...prev,
            status: 'conflict',
            conflict: {
              layoutId: serverLayout.id,
              layoutName: layoutInfo?.name ?? 'Unknown',
              serverModifiedAt: serverLayout.modifiedAt,
            },
          }));
          return;
        }

        if (!hasLocalMods && serverIsNewer) {
          // Server has newer version, update our sync state
          setStoreSyncState(serverLayout.id, {
            modifiedAt: serverLayout.modifiedAt,
            lastSyncAt: Date.now(),
          });
          updateActiveCollectionLayout(serverLayout.id, {
            modifiedAt: serverLayout.modifiedAt,
          });
        }
      }

      setSyncState((prev) => ({
        ...prev,
        status: 'synced',
        lastSyncAt: Date.now(),
        activeEditors: editors,
      }));
    } catch (error) {
      console.error('Poll error:', error);
      setSyncState((prev) => ({ ...prev, status: 'error' }));
    }
  }, [
    activeCollection,
    activeCollectionLayouts,
    syncStates,
    hasLocalChanges,
    setStoreSyncState,
    updateActiveCollectionLayout,
  ]);

  /**
   * Send heartbeat to indicate active editing.
   */
  const sendHeartbeat = useCallback(async () => {
    if (!activeCollection || !activeLayoutId || !isEditingRef.current) return;

    await collectionApi.sendHeartbeat(
      activeCollection.id,
      activeLayoutId,
      deviceIdRef.current
    );
  }, [activeCollection, activeLayoutId]);

  /**
   * Push local changes to server.
   */
  const pushChanges = useCallback(async () => {
    console.warn('[CollectionSync] pushChanges called', { activeCollection: !!activeCollection, activeLayoutId });
    if (!activeCollection || !activeLayoutId) {
      console.warn('[CollectionSync] pushChanges early return - no collection or layout');
      return;
    }
    const hasChanges = hasLocalChanges(activeLayoutId);
    console.warn('[CollectionSync] hasLocalChanges:', hasChanges);
    if (!hasChanges) {
      console.warn('[CollectionSync] pushChanges early return - no local changes');
      return;
    }

    // Check online status
    if (!navigator.onLine) {
      console.warn('[CollectionSync] pushChanges - offline');
      setSyncState((prev) => ({ ...prev, status: 'offline' }));
      return;
    }

    console.warn('[CollectionSync] Starting push to server...');
    setSyncState((prev) => ({ ...prev, status: 'syncing' }));

    const currentSyncState = syncStates[activeLayoutId];
    console.warn('[CollectionSync] Calling updateLayout API', {
      collectionId: activeCollection.id,
      layoutId: activeLayoutId,
      expectedModifiedAt: currentSyncState?.modifiedAt
    });
    const result = await collectionApi.updateLayout(
      activeCollection.id,
      activeLayoutId,
      layout,
      { expectedModifiedAt: currentSyncState?.modifiedAt }
    );
    console.warn('[CollectionSync] API result:', result);

    if (result.success) {
      // Update sync state with new server timestamp
      setStoreSyncState(activeLayoutId, {
        modifiedAt: result.data.modifiedAt,
        lastSyncAt: Date.now(),
      });
      clearLocalModification(activeLayoutId);
      updateActiveCollectionLayout(activeLayoutId, {
        modifiedAt: result.data.modifiedAt,
      });
      setSyncState((prev) => ({
        ...prev,
        status: 'synced',
        lastSyncAt: Date.now(),
      }));
    } else if (result.error.code === 'CONFLICT') {
      // Conflict detected
      const layoutInfo = activeCollectionLayouts.find(
        (l) => l.id === activeLayoutId
      );
      setSyncState((prev) => ({
        ...prev,
        status: 'conflict',
        conflict: {
          layoutId: activeLayoutId,
          layoutName: layoutInfo?.name ?? layout.name,
          serverModifiedAt: result.error.serverModifiedAt ?? Date.now(),
        },
      }));
    } else if (result.error.code === 'NETWORK_ERROR') {
      setSyncState((prev) => ({ ...prev, status: 'offline' }));
    } else {
      setSyncState((prev) => ({ ...prev, status: 'error' }));
    }
  }, [
    activeCollection,
    activeLayoutId,
    activeCollectionLayouts,
    layout,
    syncStates,
    hasLocalChanges,
    setStoreSyncState,
    clearLocalModification,
    updateActiveCollectionLayout,
  ]);

  // Ref to hold the pushChanges callback so the timeout always calls the latest version.
  // This is necessary because pushChanges depends on `layout`, which changes on every edit.
  const pushChangesRef = useRef(pushChanges);

  // Keep the ref updated with the latest pushChanges.
  useEffect(() => {
    pushChangesRef.current = pushChanges;
  }, [pushChanges]);

  /**
   * Mark layout as modified and schedule debounced push.
   */
  const onLayoutChange = useCallback(() => {
    console.warn('[CollectionSync] onLayoutChange called', { activeCollection: !!activeCollection, activeLayoutId });
    if (!activeCollection || !activeLayoutId) {
      console.warn('[CollectionSync] onLayoutChange early return - no collection or layout');
      return;
    }

    // Mark as locally modified
    console.warn('[CollectionSync] Marking layout as modified:', activeLayoutId);
    markLayoutModified(activeLayoutId);
    isEditingRef.current = true;

    // Cancel any pending push
    if (pushTimeoutRef.current) {
      console.warn('[CollectionSync] Clearing previous timeout:', pushTimeoutRef.current);
      window.clearTimeout(pushTimeoutRef.current);
    }

    // Schedule new push - use pushChangesRef to always call latest version
    console.warn('[CollectionSync] Scheduling push in', PUSH_DEBOUNCE_MS, 'ms');
    pushTimeoutRef.current = window.setTimeout(() => {
      console.warn('[CollectionSync] Push timeout fired, calling pushChanges');
      pushChangesRef.current();
      pushTimeoutRef.current = null;
    }, PUSH_DEBOUNCE_MS);
  }, [activeCollection, activeLayoutId, markLayoutModified]);

  // Ref to hold the onLayoutChange callback so the subscription doesn't depend on it.
  // This is the React "latest ref" pattern for callbacks that change frequently but
  // shouldn't cause subscribers to re-subscribe.
  const onLayoutChangeRef = useRef(onLayoutChange);

  // Keep the ref updated with the latest callback. This follows the "latest ref"
  // pattern commonly used in React to avoid re-creating subscriptions when the
  // callback changes, while still always calling the most recent implementation.
  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange;
  }, [onLayoutChange]);

  /**
   * Subscribe to layout store changes and trigger onLayoutChange.
   * This is the critical wiring that enables collection sync.
   *
   * IMPORTANT: We use onLayoutChangeRef instead of onLayoutChange directly
   * because onLayoutChange changes every time layout changes (due to pushChanges
   * depending on layout). If we used it directly, the subscription would be
   * recreated on every edit, resetting the change detection state.
   */
  useEffect(() => {
    console.warn('[CollectionSync] Subscription effect running', { activeCollection: !!activeCollection, activeLayoutId });
    // Skip if not in collection mode
    if (!activeCollection || !activeLayoutId) {
      console.warn('[CollectionSync] Not in collection mode, skipping subscription');
      isInitialMount.current = true;
      prevLayoutIdRef.current = null;
      return;
    }

    console.warn('[CollectionSync] Setting up layout store subscription');
    // Track the previous layout for comparison
    let prevLayout = useLayoutStore.getState().layout;

    // Subscribe to all state changes
    const unsubscribe = useLayoutStore.subscribe((state) => {
      const currentLayout = state.layout;
      const currentLayoutId = state.activeLayoutId;

      // Skip if layout hasn't changed (reference equality check)
      if (currentLayout === prevLayout) {
        return;
      }
      console.warn('[CollectionSync] Layout changed (reference equality check passed)');
      prevLayout = currentLayout;

      // Skip the initial mount
      if (isInitialMount.current) {
        console.warn('[CollectionSync] Skipping initial mount change');
        isInitialMount.current = false;
        prevLayoutIdRef.current = currentLayoutId;
        return;
      }

      // Skip if we just switched layouts (the layout ID changed)
      if (currentLayoutId !== prevLayoutIdRef.current) {
        console.warn('[CollectionSync] Layout ID changed, skipping', { current: currentLayoutId, prev: prevLayoutIdRef.current });
        prevLayoutIdRef.current = currentLayoutId;
        return;
      }

      // This is a real edit - trigger the sync via ref
      console.warn('[CollectionSync] Real edit detected, triggering onLayoutChange');
      onLayoutChangeRef.current();
    });

    return () => {
      console.warn('[CollectionSync] Cleaning up subscription');
      unsubscribe();
    };
  }, [activeCollection, activeLayoutId]);

  /**
   * Resolve conflict by choosing a resolution strategy.
   */
  const resolveConflict = useCallback(
    async (strategy: 'keep-mine' | 'use-theirs' | 'save-both') => {
      if (!syncState.conflict || !activeCollection) return;

      const { layoutId } = syncState.conflict;

      switch (strategy) {
        case 'keep-mine': {
          // Force push our version
          const result = await collectionApi.updateLayout(
            activeCollection.id,
            layoutId,
            layout,
            { expectedModifiedAt: undefined } // Skip conflict check
          );

          if (result.success) {
            setStoreSyncState(layoutId, {
              modifiedAt: result.data.modifiedAt,
              lastSyncAt: Date.now(),
            });
            clearLocalModification(layoutId);
          }
          break;
        }

        case 'use-theirs': {
          // Fetch and apply server version
          const result = await collectionApi.fetchLayout(
            activeCollection.id,
            layoutId
          );

          if (result.success) {
            // Import the server version into the layout store
            importLayout(result.data.layout, layoutId);

            // Update sync state
            setStoreSyncState(layoutId, {
              modifiedAt: result.data.modifiedAt,
              lastSyncAt: Date.now(),
            });
            clearLocalModification(layoutId);
          }
          break;
        }

        case 'save-both': {
          // Create a copy with the current local version
          // Server version remains, local becomes a new layout
          await collectionApi.addLayout(activeCollection.id, {
            ...layout,
            name: `${layout.name} (${new Date().toLocaleDateString()})`,
          });
          clearLocalModification(layoutId);
          break;
        }
      }

      setSyncState((prev) => ({
        ...prev,
        status: 'synced',
        conflict: null,
      }));
    },
    [
      activeCollection,
      layout,
      syncState.conflict,
      setStoreSyncState,
      clearLocalModification,
      importLayout,
    ]
  );

  // Track previous collection to detect transitions
  const prevCollectionRef = useRef<typeof activeCollection>(null);

  // Start/stop polling based on collection membership
  useEffect(() => {
    const wasInCollection = prevCollectionRef.current !== null;
    const isInCollection = activeCollection !== null;
    prevCollectionRef.current = activeCollection;

    // Clear intervals when leaving collection
    if (wasInCollection && !isInCollection) {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    if (!activeCollection) {
      return;
    }

    // Initial poll (deferred to avoid synchronous setState in effect)
    const initialPollTimeout = window.setTimeout(poll, 0);

    // Start polling interval
    pollIntervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);

    // Start heartbeat interval
    heartbeatIntervalRef.current = window.setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL_MS
    );

    return () => {
      window.clearTimeout(initialPollTimeout);
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      // NOTE: Do NOT clear pushTimeoutRef here! This effect re-runs when poll/sendHeartbeat
      // callbacks change (which happens on layout changes), and clearing the push timeout
      // would prevent changes from being saved. Push timeout is only cleared in onLayoutChange
      // (when scheduling a new push) or when leaving collection mode (separate effect below).
    };
  }, [activeCollection, poll, sendHeartbeat]);

  // Clear push timeout only when leaving collection mode (not on callback changes)
  useEffect(() => {
    return () => {
      // This cleanup only runs when activeCollection changes to null/undefined
      if (pushTimeoutRef.current) {
        console.warn('[CollectionSync] Clearing push timeout on collection exit');
        window.clearTimeout(pushTimeoutRef.current);
        pushTimeoutRef.current = null;
      }
    };
  }, [activeCollection]);

  // Reset sync state when leaving collection (outside of effect to avoid lint error)
  // We compute this as derived state based on whether we're in a collection
  const derivedSyncState = activeCollection ? syncState : {
    status: 'idle' as const,
    lastSyncAt: null,
    conflict: null,
    activeEditors: new Map<string, number>(),
  };

  // Pause polling when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!activeCollection) return;

      if (document.visibilityState === 'visible') {
        // Tab became visible - poll immediately
        poll();

        // Restart intervals if they were cleared
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
        }
        if (!heartbeatIntervalRef.current) {
          heartbeatIntervalRef.current = window.setInterval(
            sendHeartbeat,
            HEARTBEAT_INTERVAL_MS
          );
        }
      } else {
        // Tab hidden - pause polling
        if (pollIntervalRef.current) {
          window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
          window.clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeCollection, poll, sendHeartbeat]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (activeCollection) {
        poll();
        pushChanges();
      }
    };

    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeCollection, poll, pushChanges]);

  return {
    ...derivedSyncState,
    onLayoutChange,
    pushChanges,
    poll,
    resolveConflict,
    isOnline: navigator.onLine,
  };
}
