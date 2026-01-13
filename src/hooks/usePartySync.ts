/**
 * PartyKit Real-time Sync Hook
 *
 * Connects to PartyKit for real-time notifications when collection data changes.
 * Replaces polling with instant WebSocket-based updates.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import usePartySocket from 'partysocket/react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../store/collection';
import { useLayoutStore } from '../store/layout';
import * as collectionApi from '../api/collection';

// PartyKit host - use production host unless running on localhost
const PARTYKIT_HOST = typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
  ? 'gridfinity-collections.andymai.partykit.dev'
  : 'localhost:1999';

// Message types from server
interface LayoutUpdatedMessage {
  type: 'layout-updated';
  layoutId: string;
  modifiedAt: number;
  modifiedBy?: string;
}

interface LayoutAddedMessage {
  type: 'layout-added';
  layoutId: string;
  name: string;
  modifiedAt: number;
}

interface LayoutDeletedMessage {
  type: 'layout-deleted';
  layoutId: string;
}

interface CollectionUpdatedMessage {
  type: 'collection-updated';
  name?: string;
  modifiedAt: number;
}

interface PresenceUpdateMessage {
  type: 'presence-update';
  activeEditors: Record<string, number>;
  totalConnections: number;
}

type ServerMessage =
  | LayoutUpdatedMessage
  | LayoutAddedMessage
  | LayoutDeletedMessage
  | CollectionUpdatedMessage
  | PresenceUpdateMessage;

// Storage key for persistent device ID
const DEVICE_ID_KEY = 'gridfinity-device-id';

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export interface PartySyncState {
  isConnected: boolean;
  activeEditors: Record<string, number>;
  totalConnections: number;
}

export function usePartySync() {
  const {
    activeCollection,
    activeCollectionLayouts,
    syncStates,
    setSyncState,
    updateActiveCollectionLayout,
    setActiveCollectionLayouts,
  } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      activeCollectionLayouts: state.activeCollectionLayouts,
      syncStates: state.syncStates,
      setSyncState: state.setSyncState,
      updateActiveCollectionLayout: state.updateActiveCollectionLayout,
      setActiveCollectionLayouts: state.setActiveCollectionLayouts,
    }))
  );

  const { activeLayoutId, importLayout } = useLayoutStore(
    useShallow((state) => ({
      activeLayoutId: state.activeLayoutId,
      importLayout: state.importLayout,
    }))
  );

  // Track presence state (use state for values that affect rendering)
  const [activeEditors, setActiveEditors] = useState<Record<string, number>>({});
  const [totalConnections, setTotalConnections] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const deviceIdRef = useRef(getDeviceId());

  // Only connect when in a collection
  const collectionId = activeCollection?.id;

  // Track stable room ID using React's derived state pattern. When collectionId
  // becomes undefined, we keep the last known value to prevent partysocket from
  // trying to connect to a new room while we're closing.
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [stableRoomId, setStableRoomId] = useState(collectionId || '__none__');
  if (collectionId && collectionId !== stableRoomId) {
    setStableRoomId(collectionId);
  }

  // PartySocket connection
  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    party: 'collection', // Must match the party name from party/collection.ts
    room: stableRoomId,
    // Don't connect if no collection (represented by '__none__' sentinel)
    startClosed: stableRoomId === '__none__',
    onOpen: () => {
      setIsConnected(true);
      // Send initial presence (deferred to avoid stale closure)
    },
    onMessage: (event) => {
      console.warn('[PartySync] Received message:', event.data);
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        console.warn('[PartySync] Parsed message:', message);
        handleMessage(message);
      } catch (error) {
        console.error('[PartySync] Error parsing message:', error);
      }
    },
    onClose: () => {
      setIsConnected(false);
      setTotalConnections(0);
    },
    onError: (error) => {
      console.error('[PartySync] Connection error:', error);
    },
  });

  // Send presence update to server
  const sendPresence = useCallback(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'presence',
          deviceId: deviceIdRef.current,
          layoutId: activeLayoutId,
        })
      );
    }
  }, [socket, activeLayoutId]);

  // Handle incoming messages
  const handleMessage = useCallback(
    async (message: ServerMessage) => {
      console.warn('[PartySync] handleMessage called:', message.type, message);
      switch (message.type) {
        case 'layout-updated': {
          // Someone else updated a layout
          const { layoutId, modifiedAt, modifiedBy } = message;
          console.warn('[PartySync] layout-updated received:', {
            layoutId,
            modifiedAt,
            modifiedBy,
            isOurDevice: modifiedBy === deviceIdRef.current,
            activeLayoutId,
            activeCollection: !!activeCollection,
          });

          // Ignore our own updates
          if (modifiedBy === deviceIdRef.current) return;

          // Check if this affects a layout we have
          const currentSyncState = syncStates[layoutId];
          if (currentSyncState && modifiedAt > currentSyncState.modifiedAt) {
            // Server has newer version - update our sync state
            setSyncState(layoutId, {
              modifiedAt,
              lastSyncAt: Date.now(),
            });
            updateActiveCollectionLayout(layoutId, { modifiedAt });

            // If this is the active layout, fetch the new version
            if (layoutId === activeLayoutId && activeCollection) {
              const result = await collectionApi.fetchLayout(
                activeCollection.id,
                layoutId
              );
              if (result.success) {
                // Import the updated layout
                importLayout(result.data.layout, layoutId);
              }
            }
          }
          break;
        }

        case 'layout-added': {
          // New layout added to collection
          const { layoutId, name, modifiedAt } = message;

          // Add to our local list if not already there
          const exists = activeCollectionLayouts.some((l) => l.id === layoutId);
          if (!exists) {
            setActiveCollectionLayouts([
              ...activeCollectionLayouts,
              {
                id: layoutId,
                name,
                modifiedAt,
                preview: {
                  drawerWidth: 10,
                  drawerDepth: 8,
                  drawerHeight: 12,
                  binCount: 0,
                  layerCount: 1,
                },
              },
            ]);
            setSyncState(layoutId, {
              modifiedAt,
              lastSyncAt: Date.now(),
            });
          }
          break;
        }

        case 'layout-deleted': {
          // Layout removed from collection
          const { layoutId } = message;
          setActiveCollectionLayouts(
            activeCollectionLayouts.filter((l) => l.id !== layoutId)
          );
          break;
        }

        case 'collection-updated': {
          // Collection metadata changed - refresh from server
          if (activeCollection) {
            const result = await collectionApi.fetchCollection(
              activeCollection.id
            );
            if (result.success) {
              // Update local state with server data
              setActiveCollectionLayouts(result.data.layouts);
            }
          }
          break;
        }

        case 'presence-update': {
          // Update presence state
          setActiveEditors(message.activeEditors);
          setTotalConnections(message.totalConnections);
          break;
        }
      }
    },
    [
      activeCollection,
      activeCollectionLayouts,
      activeLayoutId,
      syncStates,
      setSyncState,
      updateActiveCollectionLayout,
      setActiveCollectionLayouts,
      importLayout,
    ]
  );

  // Update presence when active layout changes
  useEffect(() => {
    sendPresence();
  }, [activeLayoutId, sendPresence]);

  // Reconnect when collection changes
  useEffect(() => {
    if (collectionId) {
      socket.reconnect();
    } else {
      socket.close();
    }
  }, [collectionId, socket]);

  // Send initial presence when connected
  useEffect(() => {
    if (isConnected) {
      sendPresence();
    }
  }, [isConnected, sendPresence]);

  return {
    isConnected,
    activeEditors,
    totalConnections,
    sendPresence,
  };
}
