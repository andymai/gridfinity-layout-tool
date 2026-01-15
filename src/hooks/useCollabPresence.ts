/**
 * Hook for managing collaborative presence (cursor position, interaction hints).
 *
 * This hook provides a function to update the current user's cursor position
 * and interaction state, which is then broadcast to other connected users.
 *
 * When outside of CollabProvider, returns no-op functions that do nothing.
 *
 * @example
 * ```tsx
 * const { updateCursor, updateInteraction } = useCollabPresence();
 *
 * // In mouse move handler:
 * const gridCoord = getGridCoords(e.clientX, e.clientY);
 * updateCursor(gridCoord);
 *
 * // When leaving grid:
 * updateCursor(null);
 * ```
 */

import { useContext } from 'react';
import { PresenceContext, type CollabPresenceActions } from '../contexts/PresenceContext';

export type { CollabPresenceActions };

/**
 * Provides functions to update the current user's presence in a collaborative session.
 *
 * Cursor updates are throttled to 50ms (20fps) to reduce network traffic
 * while maintaining smooth visual updates.
 *
 * When not in collaborative mode (outside CollabProvider), returns no-op
 * functions to maintain API compatibility.
 */
export function useCollabPresence(): CollabPresenceActions {
  return useContext(PresenceContext);
}
