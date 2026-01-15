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
  /** Cursor position as normalized coords (0-1 range), null if outside grid */
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
 * Check if Liveblocks is configured.
 * Collaborative features are disabled when the public key is not set.
 */
const LIVEBLOCKS_PUBLIC_KEY = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;
export const isLiveblocksConfigured = Boolean(LIVEBLOCKS_PUBLIC_KEY);

/**
 * Liveblocks client configuration.
 *
 * Uses public key for simpler setup. For production with server-side
 * permission control, switch to authEndpoint: '/api/liveblocks-auth'
 * and set LIVEBLOCKS_SECRET_KEY environment variable.
 *
 * Client is only created when the public key is available.
 */
const client = isLiveblocksConfigured
  ? createClient({
      publicApiKey: LIVEBLOCKS_PUBLIC_KEY,
      // Throttle presence updates to 20fps (50ms) to balance smoothness and bandwidth
      throttle: 50,
    })
  : null;

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
 *
 * Context is only created when the client is available.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const context = client ? createRoomContext<any, any>(client) : null;

/**
 * Stub RoomProvider for when Liveblocks is not configured.
 * Just renders children without any collaborative features.
 */
const StubRoomProvider: React.ComponentType<{
  id: string;
  initialPresence: UserPresence;
  initialStorage?: LiveblocksStorage;
  children: React.ReactNode;
}> = ({ children }) => children as React.ReactElement;

/**
 * Helper to create a stub hook that throws when called without Liveblocks configured.
 * This helps catch programming errors where hooks are used without checking isLiveblocksConfigured.
 */
const createUnconfiguredHook = (hookName: string) => () => {
  throw new Error(
    `${hookName} called but Liveblocks is not configured. ` +
    `Check isLiveblocksConfigured before using collaborative features.`
  );
};

/**
 * Safe stub hooks that return empty/default values.
 * These can be called unconditionally without throwing.
 */
const safeStubHooks = {
  useOthers: () => [] as readonly { connectionId: number; presence: UserPresence }[],
  useSelf: () => null as { connectionId: number; presence: UserPresence } | null,
  useStatus: () => 'initial' as string,
  useStorage: <T,>(_selector: (root: LiveblocksStorage) => T) => null as T | null,
};

/**
 * Create a safe wrapper around a Liveblocks hook that catches
 * "RoomProvider missing" errors and returns a fallback value.
 *
 * This allows hooks to be called outside of RoomProvider without crashing,
 * which is important during the loading phase when SharedLayoutImporter
 * hasn't yet determined if we're in collaborative mode.
 */
function createSafeHook<TArgs extends unknown[], TReturn>(
  realHook: ((...args: TArgs) => TReturn) | null | undefined,
  stubHook: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  if (!realHook) return stubHook;

  return (...args: TArgs): TReturn => {
    try {
      return realHook(...args);
    } catch (error) {
      // Check if this is the "RoomProvider missing" error
      if (error instanceof Error && error.message.includes('RoomProvider')) {
        // Return safe default instead of crashing
        return stubHook(...args);
      }
      // Re-throw other errors
      throw error;
    }
  };
}

// Re-export hooks with proper typing via type assertions
// When Liveblocks is not configured, provide stubs that throw helpful errors
export const RoomProvider = (context?.RoomProvider ?? StubRoomProvider) as React.ComponentType<{
  id: string;
  initialPresence: UserPresence;
  initialStorage?: LiveblocksStorage;
  children: React.ReactNode;
}>;
export const useMyPresence = (context?.useMyPresence ?? createUnconfiguredHook('useMyPresence')) as () => [
  UserPresence,
  (patch: Partial<UserPresence>) => void,
];
export const useUpdateMyPresence = (context?.useUpdateMyPresence ?? createUnconfiguredHook('useUpdateMyPresence')) as () => (
  patch: Partial<UserPresence>
) => void;
// Safe hooks that return defaults when not configured OR when called outside RoomProvider
// These can be called unconditionally - they catch RoomProvider errors and return safe defaults
export const useOthers = createSafeHook(
  context?.useOthers as (() => readonly { connectionId: number; presence: UserPresence }[]) | undefined,
  safeStubHooks.useOthers
) as () => readonly { connectionId: number; presence: UserPresence }[];

export const useOthersMapped = context?.useOthersMapped ?? createUnconfiguredHook('useOthersMapped');
export const useOthersConnectionIds = context?.useOthersConnectionIds ?? createUnconfiguredHook('useOthersConnectionIds');
export const useOther = context?.useOther ?? createUnconfiguredHook('useOther');

export const useSelf = createSafeHook(
  context?.useSelf as (() => { connectionId: number; presence: UserPresence } | null) | undefined,
  safeStubHooks.useSelf
) as () => { connectionId: number; presence: UserPresence } | null;

export const useStorage = createSafeHook(
  context?.useStorage as (<T>(selector: (root: LiveblocksStorage) => T) => T | null) | undefined,
  safeStubHooks.useStorage
) as <T>(selector: (root: LiveblocksStorage) => T) => T | null;
export const useMutation = context?.useMutation ?? createUnconfiguredHook('useMutation');
export const useRoom = context?.useRoom ?? createUnconfiguredHook('useRoom');
export const useBroadcastEvent = context?.useBroadcastEvent ?? createUnconfiguredHook('useBroadcastEvent');
export const useEventListener = context?.useEventListener ?? createUnconfiguredHook('useEventListener');

export const useStatus = createSafeHook(
  context?.useStatus as (() => string) | undefined,
  safeStubHooks.useStatus
) as () => string;
export const useHistory = context?.useHistory ?? createUnconfiguredHook('useHistory');
export const useUndo = context?.useUndo ?? createUnconfiguredHook('useUndo');
export const useRedo = context?.useRedo ?? createUnconfiguredHook('useRedo');
export const useCanUndo = context?.useCanUndo ?? createUnconfiguredHook('useCanUndo');
export const useCanRedo = context?.useCanRedo ?? createUnconfiguredHook('useCanRedo');
