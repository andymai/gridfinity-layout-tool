/**
 * Collaborative editing provider component.
 *
 * Wraps children with Liveblocks RoomProvider when in collaborative mode.
 * Handles user identification, initial presence, and storage setup.
 *
 * Mutations go through the local store and are synced to Liveblocks
 * via the useCollabSync hook (bidirectional sync).
 */

import type { ReactNode } from 'react';
import { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  RoomProvider,
  useUpdateMyPresence,
  isLiveblocksConfigured,
  type LiveblocksStorage,
  type UserPresence,
  type InteractionHint,
} from '@/liveblocks.config';
import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useUIStore } from '@/core/store/ui';
import { generateId } from '@/core/constants';
import { generateGuestName, generateGuestColor } from '@/utils/guestNames';
import { PresenceContext, type CollabPresenceActions, LocalMutationsProvider } from '@/shared/contexts';
import type { Coord } from '@/core/types';
import { throttle } from '@/shared/utils';
import { useCollabSync } from '@/hooks/useCollabSync';
import { useCloudShareAutoSync } from '@/features/cloud-share/hooks/useCloudShareAutoSync';

interface CollabProviderProps {
  /** The share ID for the collaborative session */
  shareId: string;
  /** Child components to render inside the provider */
  children: ReactNode;
}

/**
 * Get or create a stable user ID from localStorage.
 * This acts as a browser fingerprint for owner identification.
 */
function getUserId(): string {
  const key = 'gridfinity-user-id';
  try {
    let userId = localStorage.getItem(key);
    if (!userId) {
      userId = generateId();
      localStorage.setItem(key, userId);
    }
    return userId;
  } catch {
    // Fallback for private browsing or storage quota errors
    // Generate a temporary ID for this session
    return generateId();
  }
}

/**
 * Get the user's display name from library settings.
 * Falls back to a fun generated name if no author name is set.
 */
function useUserName(userId: string): string {
  const authorName = useLibraryStore((state) => state.library.settings.authorName);
  return authorName || generateGuestName(userId);
}

/**
 * CollabProvider wraps the app with Liveblocks RoomProvider
 * to enable real-time collaboration.
 *
 * If Liveblocks is not configured (no API key), falls back to
 * LocalMutationsProvider for local-only mode.
 *
 * @example
 * ```tsx
 * <CollabProvider shareId="abc123xyz">
 *   <App />
 * </CollabProvider>
 * ```
 */
export function CollabProvider({ shareId, children }: CollabProviderProps) {
  // If Liveblocks is not configured, fall back to local-only mode
  // This allows the app to function without collaborative features
  if (!isLiveblocksConfigured) {
    return <LocalMutationsProvider>{children}</LocalMutationsProvider>;
  }

  return <LiveblocksCollabProvider shareId={shareId}>{children}</LiveblocksCollabProvider>;
}

/**
 * Inner component that actually uses Liveblocks.
 * This is separated to avoid conditional hooks in the outer component.
 */
function LiveblocksCollabProvider({ shareId, children }: CollabProviderProps) {
  const roomId = `gridfinity-${shareId}`;
  const userId = useMemo(() => getUserId(), []);
  const userName = useUserName(userId);
  const layout = useLayoutStore((state) => state.layout);

  // Check if user is owner (layout exists in their library with matching ID)
  // Since share IDs equal layout UUIDs, we check entry.id directly
  const entries = useLibraryStore((state) => state.library.entries);
  const cloudShare = useMemo(
    () => entries.find((e) => e.id === shareId)?.cloudShare ?? null,
    [entries, shareId]
  );

  // Initial presence - cursor starts as null (outside grid)
  // Color is deterministically generated from userId for variety
  const initialPresence: UserPresence = useMemo(
    () => ({
      cursor: null,
      name: userName,
      color: generateGuestColor(userId),
      interaction: { type: 'idle' },
    }),
    [userName, userId]
  );

  // Initial storage - the layout data to sync
  // If user is owner, include deleteToken so any collaborator can sync to blob
  const initialStorage: LiveblocksStorage = useMemo(
    () => ({
      layout,
      metadata: {
        ownerId: userId,
        permission: cloudShare?.permission ?? 'edit',
        version: 1,
        // Owner shares the deleteToken so any collaborator can persist to blob
        deleteToken: cloudShare?.deleteToken,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: only use layout on initial mount, not on every change
    []
  );

  return (
    <RoomProvider
      id={roomId}
      initialPresence={initialPresence}
      initialStorage={initialStorage}
    >
      <PresenceProvider shareId={shareId}>{children}</PresenceProvider>
    </RoomProvider>
  );
}

/**
 * Inner component that provides presence actions and handles sync.
 * Must be inside RoomProvider to access Liveblocks hooks.
 *
 * Mutations now go through LocalMutationsProvider (which uses the store directly).
 * The useCollabSync hook handles bidirectional sync between store and Liveblocks.
 */
function PresenceProvider({ shareId, children }: { shareId: string; children: ReactNode }) {
  const updateMyPresence = useUpdateMyPresence();

  // Enable bidirectional sync between Liveblocks and Zustand
  useCollabSync();

  // Auto-sync layout changes to cloud share storage (only owner has cloudShare info)
  useCloudShareAutoSync(shareId, true);

  // Auto-dismiss Liveblocks badge (injected asynchronously by Liveblocks SDK)
  useEffect(() => {
    const dismissBadge = () => {
      const hideButton = document.getElementById('liveblocks-badge-hide-button');
      if (hideButton) {
        hideButton.click();
        return true;
      }
      return false;
    };

    // Try immediately, then poll briefly in case badge loads async
    if (!dismissBadge()) {
      const interval = setInterval(() => {
        if (dismissBadge()) {
          clearInterval(interval);
        }
      }, 100);

      // Stop polling after 3 seconds
      const timeout = setTimeout(() => clearInterval(interval), 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  // Create throttled cursor update (50ms = 20fps)
  const throttledUpdateCursorRef = useRef<((cursor: Coord | null) => void) | null>(null);

  useEffect(() => {
    throttledUpdateCursorRef.current = throttle((cursor: Coord | null) => {
      updateMyPresence({ cursor });
    }, 50);

    return () => {
      throttledUpdateCursorRef.current = null;
    };
  }, [updateMyPresence]);

  // Create throttled selection update (100ms = 10fps, less frequent than cursor)
  const throttledUpdateSelectionRef = useRef<((binIds: string[]) => void) | null>(null);

  useEffect(() => {
    throttledUpdateSelectionRef.current = throttle((binIds: string[]) => {
      updateMyPresence({ selectedBinIds: binIds });
    }, 100);

    return () => {
      throttledUpdateSelectionRef.current = null;
    };
  }, [updateMyPresence]);

  // Auto-broadcast selection changes from UI store
  useEffect(() => {
    // Track previous selection to detect changes
    let prevSelection = useUIStore.getState().selectedBinIds;

    // Subscribe to entire state and filter for selection changes
    const unsubscribe = useUIStore.subscribe((state) => {
      const currentSelection = state.selectedBinIds;
      // Only update if selection actually changed
      if (
        currentSelection.length !== prevSelection.length ||
        currentSelection.some((id, i) => id !== prevSelection[i])
      ) {
        prevSelection = currentSelection;
        if (throttledUpdateSelectionRef.current) {
          throttledUpdateSelectionRef.current(currentSelection);
        }
      }
    });

    // Broadcast initial selection state
    if (throttledUpdateSelectionRef.current) {
      throttledUpdateSelectionRef.current(prevSelection);
    }

    return unsubscribe;
  }, []);

  const updateCursor = useCallback(
    (cursor: Coord | null) => {
      if (throttledUpdateCursorRef.current) {
        throttledUpdateCursorRef.current(cursor);
      }
    },
    []
  );

  const updateInteraction = useCallback(
    (interaction: InteractionHint) => {
      updateMyPresence({ interaction });
    },
    [updateMyPresence]
  );

  const updateSelection = useCallback(
    (binIds: string[]) => {
      if (throttledUpdateSelectionRef.current) {
        throttledUpdateSelectionRef.current(binIds);
      }
    },
    []
  );

  const clearPresence = useCallback(() => {
    updateMyPresence({
      cursor: null,
      interaction: { type: 'idle' },
      selectedBinIds: [],
    });
  }, [updateMyPresence]);

  const presenceActions: CollabPresenceActions = useMemo(
    () => ({
      updateCursor,
      updateInteraction,
      updateSelection,
      clearPresence,
    }),
    [updateCursor, updateInteraction, updateSelection, clearPresence]
  );

  return (
    <PresenceContext.Provider value={presenceActions}>
      <LocalMutationsProvider>{children}</LocalMutationsProvider>
    </PresenceContext.Provider>
  );
}
