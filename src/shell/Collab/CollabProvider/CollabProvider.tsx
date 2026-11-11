/**
 * Collaborative editing provider component.
 *
 * Wraps children with Liveblocks RoomProvider when in collaborative mode.
 * Handles user identification, initial presence, and storage setup.
 *
 * Mutations go through the local store and are synced to Liveblocks
 * via the useCollabSync hook (bidirectional sync).
 *
 * Security note: the delete token is NOT stored in Liveblocks shared storage.
 * Cloud sync is restricted to the share owner (the user who has the delete token
 * in their local library). Non-owners cannot write to Vercel Blob.
 */

import type { ReactNode } from 'react';
import { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  RoomProvider,
  useRoom,
  useUpdateMyPresence,
  isLiveblocksConfigured,
  type LiveblocksStorage,
  type UserPresence,
  type InteractionHint,
} from '@/liveblocks.config';
import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useSharedPreviewStore, type SharedPreviewData } from '@/core/store/sharedPreview';
import { generateId } from '@/core/constants';
import { generateGuestName, generateGuestColor } from '@/shared/utils/guestNames';
import { trackEvent } from '@/shared/analytics/posthog';
import {
  PresenceContext,
  type CollabPresenceActions,
  LocalMutationsProvider,
} from '@/shared/contexts';
import type { CloudShareInfo, Coord } from '@/core/types';
import { throttle } from '@/shared/utils';
import { stampFor } from '@/shared/utils/roomLinkStamp';
import { useCollabSync } from '@/shared/hooks/useCollabSync';
import { useCloudShareAutoSync } from '@/features/cloud-share/hooks/useCloudShareAutoSync';
import { readOwnCopyRevision } from '@/features/cloud-share/utils';

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
 * The share link revision that this browser's copy of the layout corresponds
 * to: the owner's last save of its own copy, or the revision a visitor fetched.
 */
function copyRevisionFor(
  shareId: string,
  ownedShare: CloudShareInfo | null,
  sharedPreview: SharedPreviewData | null
): string | undefined {
  if (ownedShare) return readOwnCopyRevision(shareId);
  if (sharedPreview?.cloudShareId === shareId) return sharedPreview.linkUpdatedAt;
  return undefined;
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

  // Track collab session start
  useEffect(() => {
    trackEvent('ui.featureUsed', { feature: 'collab_session' });
  }, []);

  // Match on the share's own id: a layout that re-shared under a fresh id
  // still has its old id, and that old share's room must never be handed the
  // new share's delete token.
  const entries = useLibraryStore((state) => state.library.entries);
  const cloudShare = useMemo(
    () => entries.find((e) => e.cloudShare?.id === shareId)?.cloudShare ?? null,
    [entries, shareId]
  );
  const sharedPreview = useSharedPreviewStore((state) => state.sharedPreview);

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
  // The delete token is intentionally NOT stored in shared storage.
  // Cloud sync is owner-only: the delete token stays in the owner's local library.
  // RoomProvider freezes initialStorage per room id, so this is taken once per room.
  const { copyRevision, initialStorage } = useMemo(() => {
    const revision = copyRevisionFor(shareId, cloudShare, sharedPreview);
    const storage: LiveblocksStorage = {
      layout,
      metadata: {
        ownerId: userId,
        permission: cloudShare?.permission ?? 'edit',
        version: 2,
        ...stampFor(layout, revision),
      },
    };
    return { copyRevision: revision, initialStorage: storage };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: the layout as the room is entered, not on every change
  }, [roomId]);

  return (
    <RoomProvider id={roomId} initialPresence={initialPresence} initialStorage={initialStorage}>
      <PresenceProvider
        roomId={roomId}
        shareId={shareId}
        ownerDeleteToken={cloudShare?.deleteToken}
        copyRevision={copyRevision}
      >
        {children}
      </PresenceProvider>
    </RoomProvider>
  );
}

interface RoomSyncProps {
  shareId: string;
  ownerDeleteToken: string | undefined;
  copyRevision: string | undefined;
}

function RoomSync({ shareId, ownerDeleteToken, copyRevision }: RoomSyncProps): null {
  // Enable bidirectional sync between Liveblocks and Zustand
  useCollabSync(copyRevision);

  // Auto-sync layout changes to cloud share storage (owner-only: token only present for owner)
  useCloudShareAutoSync(shareId, ownerDeleteToken);

  return null;
}

/**
 * Inner component that provides presence actions and handles sync.
 * Must be inside RoomProvider to access Liveblocks hooks.
 *
 * Mutations now go through LocalMutationsProvider (which uses the store directly).
 * The useCollabSync hook handles bidirectional sync between store and Liveblocks.
 *
 * ownerDeleteToken is only defined for the share owner. It enables cloud sync
 * from this client without broadcasting the token to other collaborators.
 */
function PresenceProvider({
  roomId,
  shareId,
  ownerDeleteToken,
  copyRevision,
  children,
}: RoomSyncProps & {
  roomId: string;
  children: ReactNode;
}) {
  const updateMyPresence = useUpdateMyPresence();
  const room = useRoom();

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
    let prevSelection = useSelectionStore.getState().selectedBinIds;

    // Subscribe to entire state and filter for selection changes
    const unsubscribe = useSelectionStore.subscribe((state) => {
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

  const updateCursor = useCallback((cursor: Coord | null) => {
    if (throttledUpdateCursorRef.current) {
      throttledUpdateCursorRef.current(cursor);
    }
  }, []);

  const updateInteraction = useCallback(
    (interaction: InteractionHint) => {
      updateMyPresence({ interaction });
    },
    [updateMyPresence]
  );

  const updateSelection = useCallback((binIds: string[]) => {
    if (throttledUpdateSelectionRef.current) {
      throttledUpdateSelectionRef.current(binIds);
    }
  }, []);

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
      {/* RoomProvider moves to a new room one render after the share changes.
          Until it does, the room in context is the previous share's, and a
          sync would pair it with this share's copy and delete token. */}
      {room.id === roomId && (
        <RoomSync
          key={roomId}
          shareId={shareId}
          ownerDeleteToken={ownerDeleteToken}
          copyRevision={copyRevision}
        />
      )}
    </PresenceContext.Provider>
  );
}
