import { useSessionLifecycle } from './session/useSession';

/**
 * Side-effect-only mount point that runs the session lifecycle hook
 * (initial /api/auth/me, visibilitychange refresh, BroadcastChannel
 * subscription, forced-sign-out listener).
 *
 * Wrapped as a component so the parent can conditionally render it
 * based on `SYNC_UI_ENABLED` without violating the rules of hooks.
 * Vite tree-shakes the entire module when the gate is false.
 */
export function SyncSessionMount(): null {
  useSessionLifecycle();
  return null;
}
