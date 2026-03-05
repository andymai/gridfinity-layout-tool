/**
 * Hook for accessing presence data in collaborative editing mode.
 *
 * Aggregates data from Liveblocks hooks (useOthers, useSelf, useStatus)
 * into a unified participant list with owner detection and join/leave
 * toast notifications.
 *
 * @example
 * ```tsx
 * const { participants, status, participantCount } = usePresence();
 *
 * if (status === 'connected') {
 *   console.log(`${participantCount} users online`);
 * }
 * ```
 */

import { useMemo, useEffect, useRef } from 'react';
import { useOthers, useSelf, useStatus, useStorage } from '@/liveblocks.config';
import { useCollabMode } from './useCollabMode';
import { useToastStore } from '@/core/store/toast';
import { generateGuestName, generateGuestColor } from '@/utils/guestNames';

/**
 * Represents a participant in a collaborative session.
 */
export interface Participant {
  /** Unique identifier (connection ID as string) */
  id: string;
  /** Display name */
  name: string;
  /** Assigned color (hex) */
  color: string;
  /** Whether this participant is the layout owner */
  isOwner: boolean;
  /** Whether this is the current user */
  isSelf: boolean;
}

/**
 * Connection status for the collaborative session.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/**
 * Return type for the usePresence hook.
 */
export interface PresenceState {
  /** All participants including self */
  participants: Participant[];
  /** Current connection status */
  status: ConnectionStatus;
  /** Total participant count */
  participantCount: number;
  /** Whether we're in collaborative mode */
  isCollaborative: boolean;
}

/**
 * Empty state returned when not in collaborative mode.
 */
const EMPTY_STATE: PresenceState = {
  participants: [],
  status: 'disconnected',
  participantCount: 0,
  isCollaborative: false,
};

/**
 * Hook to access presence data for collaborative editing.
 *
 * Must be used within a Liveblocks RoomProvider context when in collaborative mode.
 * Returns empty state when not collaborative or Liveblocks is not configured.
 */
export function usePresence(): PresenceState {
  const { isCollaborative } = useCollabMode();
  const addToast = useToastStore((state) => state.addToast);

  // Track previous participant IDs for join/leave detection
  const prevParticipantIdsRef = useRef<Set<string>>(new Set());
  const prevParticipantNamesRef = useRef<Map<string, string>>(new Map());
  const isInitialMountRef = useRef(true);

  // Liveblocks hooks - always called (safe stubs return defaults when not configured)
  // This ensures hooks are called in the same order every render
  const others = useOthers();
  const self = useSelf();
  const liveblocksStatus = useStatus();
  const ownerId = useStorage((root) => root.metadata.ownerId);

  // Map Liveblocks status to our connection status
  const status: ConnectionStatus = useMemo(() => {
    if (!isCollaborative) return 'disconnected';

    switch (liveblocksStatus) {
      case 'connected':
        return 'connected';
      case 'reconnecting':
        return 'reconnecting';
      case 'connecting':
      case 'initial':
        return 'connecting';
      default:
        return 'disconnected';
    }
  }, [isCollaborative, liveblocksStatus]);

  // Build participant list
  const participants: Participant[] = useMemo(() => {
    if (!isCollaborative) return [];

    const result: Participant[] = [];

    for (const other of others) {
      const id = String(other.connectionId);
      result.push({
        id,
        name: other.presence.name || generateGuestName(other.connectionId),
        color: other.presence.color || generateGuestColor(other.connectionId),
        isOwner: ownerId ? id === ownerId : false,
        isSelf: false,
      });
    }

    if (self) {
      const id = String(self.connectionId);
      result.push({
        id,
        name: self.presence.name || generateGuestName(self.connectionId),
        color: self.presence.color || generateGuestColor(self.connectionId),
        isOwner: ownerId ? id === ownerId : false,
        isSelf: true,
      });
    }

    // Sort: owner first, then self, then alphabetically by name
    result.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [isCollaborative, others, self, ownerId]);

  const participantCount = participants.length;

  // Handle join/leave toast notifications
  useEffect(() => {
    if (!isCollaborative) {
      // Reset tracking when leaving collaborative mode
      prevParticipantIdsRef.current = new Set();
      prevParticipantNamesRef.current = new Map();
      isInitialMountRef.current = true;
      return;
    }

    // Build current participant map
    const currentIds = new Set(participants.map((p) => p.id));
    const currentNames = new Map(participants.map((p) => [p.id, p.name]));

    // Skip notifications on initial mount
    if (isInitialMountRef.current) {
      prevParticipantIdsRef.current = currentIds;
      prevParticipantNamesRef.current = currentNames;
      isInitialMountRef.current = false;
      return;
    }

    for (const id of currentIds) {
      if (!prevParticipantIdsRef.current.has(id)) {
        const name = currentNames.get(id) ?? 'Someone';
        // Don't show toast for self
        const participant = participants.find((p) => p.id === id);
        if (participant && !participant.isSelf) {
          addToast({
            message: `${name} joined`,
            type: 'info',
            duration: 3000,
          });
        }
      }
    }

    for (const id of prevParticipantIdsRef.current) {
      if (!currentIds.has(id)) {
        const name = prevParticipantNamesRef.current.get(id) ?? 'Someone';
        addToast({
          message: `${name} left`,
          type: 'info',
          duration: 3000,
        });
      }
    }

    prevParticipantIdsRef.current = currentIds;
    prevParticipantNamesRef.current = currentNames;
  }, [isCollaborative, participants, addToast]);

  if (!isCollaborative) {
    return EMPTY_STATE;
  }

  return {
    participants,
    status,
    participantCount,
    isCollaborative,
  };
}

// Re-export getInitials from its proper location
export { getInitials } from '@/utils/guestNames';
