/**
 * Context for collaborative presence actions.
 *
 * This context provides functions for updating cursor position and
 * interaction state that are broadcast to other connected users.
 *
 * When outside CollabProvider, no-op functions are returned.
 */

import { createContext } from 'react';
import type { InteractionHint } from '../liveblocks.config';
import type { Coord } from '../types';

export interface CollabPresenceActions {
  /** Update cursor position (null when outside grid) */
  updateCursor: (cursor: Coord | null) => void;
  /** Update current interaction hint for remote previews */
  updateInteraction: (interaction: InteractionHint) => void;
  /** Clear presence when leaving collaborative mode */
  clearPresence: () => void;
}

/**
 * Default no-op implementations for when not in collaborative mode.
 * These functions do nothing but maintain API compatibility.
 */
const noopActions: CollabPresenceActions = {
  updateCursor: () => {},
  updateInteraction: () => {},
  clearPresence: () => {},
};

/**
 * Context for presence update functions.
 * Default value provides no-op functions for non-collaborative mode.
 */
export const PresenceContext = createContext<CollabPresenceActions>(noopActions);
