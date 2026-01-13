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

  // Refs for intervals
  const pollIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const pushTimeoutRef = useRef<number | null>(null);
  const lastPollModifiedAt = useRef<number | null>(null);
  const deviceIdRef = useRef<string>(getDeviceId());

  // Track if we're currently editing
  const isEditingRef = useRef(false);

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
    if (!activeCollection || !activeLayoutId) return;
    if (!hasLocalChanges(activeLayoutId)) return;

    // Check online status
    if (!navigator.onLine) {
      setSyncState((prev) => ({ ...prev, status: 'offline' }));
      return;
    }

    setSyncState((prev) => ({ ...prev, status: 'syncing' }));

    const currentSyncState = syncStates[activeLayoutId];
    const result = await collectionApi.updateLayout(
      activeCollection.id,
      activeLayoutId,
      layout,
      { expectedModifiedAt: currentSyncState?.modifiedAt }
    );

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

  /**
   * Mark layout as modified and schedule debounced push.
   */
  const onLayoutChange = useCallback(() => {
    if (!activeCollection || !activeLayoutId) return;

    // Mark as locally modified
    markLayoutModified(activeLayoutId);
    isEditingRef.current = true;

    // Cancel any pending push
    if (pushTimeoutRef.current) {
      window.clearTimeout(pushTimeoutRef.current);
    }

    // Schedule new push
    pushTimeoutRef.current = window.setTimeout(() => {
      pushChanges();
      pushTimeoutRef.current = null;
    }, PUSH_DEBOUNCE_MS);
  }, [activeCollection, activeLayoutId, markLayoutModified, pushChanges]);

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
            // Update the layout store with server version
            // This would need integration with useLayoutSwitcher or similar
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
      if (pushTimeoutRef.current) {
        window.clearTimeout(pushTimeoutRef.current);
        pushTimeoutRef.current = null;
      }
    };
  }, [activeCollection, poll, sendHeartbeat]);

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
