/**
 * Liveblocks configuration for real-time collaborative editing.
 *
 * This file sets up the Liveblocks client and creates typed React hooks
 * for accessing presence and storage data.
 *
 * @see https://liveblocks.io/docs/api-reference/liveblocks-react
 */

import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';
import type { Layout, Coord, ResizeHandle } from './types';

/**
 * User presence data - ephemeral state visible to other users.
 * Presence is automatically cleared when a user disconnects.
 */
export interface UserPresence {
  /** Current cursor position in grid coordinates, null if outside grid */
  cursor: Coord | null;
  /** User's display name */
  name: string;
  /** User's assigned color (hex) */
  color: string;
  /** Current interaction hint for showing remote operation previews */
  interaction?: InteractionHint;
}

/**
 * Hints about what interaction a remote user is performing.
 * Used to show visual previews of other users' in-progress operations.
 */
export type InteractionHint =
  | { type: 'idle' }
  | { type: 'selecting'; start: Coord; current: Coord }
  | { type: 'dragging'; binIds: string[]; delta: Coord }
  | { type: 'resizing'; binIds: string[]; handle: ResizeHandle }
  | { type: 'drawing'; start: Coord; current: Coord };

/**
 * Liveblocks storage structure - persistent shared state.
 * This data is synchronized in real-time between all connected users.
 */
export interface LiveblocksStorage {
  /** The shared layout data */
  layout: Layout;
  /** Metadata about the collaborative session */
  metadata: {
    /** Owner's browser fingerprint ID */
    ownerId: string;
    /** Current permission level for non-owner users */
    permission: 'view' | 'edit';
    /** Schema version for migrations */
    version: number;
    /** Delete token for cloud share updates (set by owner, used by all collaborators) */
    deleteToken?: string;
  };
}

/**
 * Liveblocks client configuration.
 *
 * Uses public key for simpler setup. For production with server-side
 * permission control, switch to authEndpoint: '/api/liveblocks-auth'
 * and set LIVEBLOCKS_SECRET_KEY environment variable.
 */
const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY || '',
  // Throttle presence updates to 20fps (50ms) to balance smoothness and bandwidth
  throttle: 50,
});

/**
 * Create typed room context with our presence and storage types.
 * This provides React hooks that are automatically typed to our schema.
 *
 * Note: Type assertion to `any` is used because Liveblocks requires types to
 * extend JsonObject (with index signatures), but our interfaces define specific
 * properties without index signatures for type safety. The hooks below are
 * re-exported with proper typing via type assertions.
 *
 * This is a common pattern with Liveblocks - see their examples:
 * @see https://liveblocks.io/docs/guides/how-to-create-a-collaborative-to-do-list-with-react-and-liveblocks
 *
 * TODO: When Liveblocks adds better TypeScript support for strict types,
 * update this to use UserPresence and LiveblocksStorage directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const context = createRoomContext<any, any>(client);

// Re-export hooks with proper typing via type assertions
export const RoomProvider = context.RoomProvider as React.ComponentType<{
  id: string;
  initialPresence: UserPresence;
  initialStorage?: LiveblocksStorage;
  children: React.ReactNode;
}>;
export const useMyPresence = context.useMyPresence as () => [
  UserPresence,
  (patch: Partial<UserPresence>) => void,
];
export const useUpdateMyPresence = context.useUpdateMyPresence as () => (
  patch: Partial<UserPresence>
) => void;
export const useOthers = context.useOthers as () => readonly {
  connectionId: number;
  presence: UserPresence;
}[];
export const useOthersMapped = context.useOthersMapped;
export const useOthersConnectionIds = context.useOthersConnectionIds;
export const useOther = context.useOther;
export const useSelf = context.useSelf as () => {
  connectionId: number;
  presence: UserPresence;
} | null;
export const useStorage = context.useStorage;
export const useMutation = context.useMutation;
export const useRoom = context.useRoom;
export const useBroadcastEvent = context.useBroadcastEvent;
export const useEventListener = context.useEventListener;
export const useStatus = context.useStatus;
export const useHistory = context.useHistory;
export const useUndo = context.useUndo;
export const useRedo = context.useRedo;
export const useCanUndo = context.useCanUndo;
export const useCanRedo = context.useCanRedo;
