import { create } from 'zustand';
import { useEffect } from 'react';
import { FORCED_SIGN_OUT_EVENT } from '../apiFetch';
import { getMe, type SessionUser } from './sessionApi';

export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  /** Refresh from /api/auth/me. Broadcasts the resulting state to other tabs. */
  refresh: () => Promise<void>;
  /** Local sign-in commit (e.g. after OAuth callback). Broadcasts. */
  setAuthenticated: (user: SessionUser) => void;
  /** Local sign-out commit (explicit sign-out, forced 401). Broadcasts. */
  setAnonymous: () => void;
  /** Apply an external state change (e.g. another tab's broadcast) without
   *  re-broadcasting. Use only inside the BroadcastChannel handler. */
  applyRemoteState: (status: 'authenticated' | 'anonymous') => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'unknown',
  user: null,
  refresh: async () => {
    const next = await refreshFromServer();
    if (!next) return;
    set(next.state);
    broadcastSessionChange(next.broadcastType);
  },
  setAuthenticated: (user) => {
    set({ status: 'authenticated', user });
    broadcastSessionChange('authenticated');
  },
  setAnonymous: () => {
    set({ status: 'anonymous', user: null });
    broadcastSessionChange('anonymous');
  },
  applyRemoteState: async (status) => {
    if (status === 'authenticated') {
      // Another tab signed in. Fetch the user record (we don't trust the
      // broadcast payload — the cookie is the source of truth).
      const next = await refreshFromServer();
      if (next) set(next.state);
    } else if (get().status !== 'anonymous') {
      set({ status: 'anonymous', user: null });
    }
  },
}));

/** Hits /api/auth/me and returns the resulting state, or null on transient error. */
async function refreshFromServer(): Promise<{
  state: { status: SessionStatus; user: SessionUser | null };
  broadcastType: 'authenticated' | 'anonymous';
} | null> {
  try {
    const user = await getMe();
    return user
      ? { state: { status: 'authenticated', user }, broadcastType: 'authenticated' }
      : { state: { status: 'anonymous', user: null }, broadcastType: 'anonymous' };
  } catch {
    // Network error during refresh: don't mutate state. Better to stay where
    // we are and re-try on next visibility flip than spuriously sign out.
    return null;
  }
}

const SESSION_CHANNEL = 'gflt-session';

interface SessionBroadcast {
  type: 'authenticated' | 'anonymous';
  /** Tab-local id so the sender can ignore its own broadcast. */
  source: string;
}

const TAB_ID = (() => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
})();

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(SESSION_CHANNEL);
  return channel;
}

function broadcastSessionChange(type: SessionBroadcast['type']): void {
  getChannel()?.postMessage({ type, source: TAB_ID } satisfies SessionBroadcast);
}

/**
 * Hook that wires three triggers to refresh the session store:
 *   1. Mount — initial `getMe()` resolves the 'unknown' status.
 *   2. `visibilitychange` to visible — catches sessions that expired or
 *      were revoked while the tab was hidden.
 *   3. `BroadcastChannel('gflt-session')` — multi-tab coherence: another
 *      tab's sign-in/out propagates instantly, no polling.
 *   4. `gflt:forced-sign-out` window event — `apiFetch` emits this on 401,
 *      letting any in-flight authenticated request flip the UI.
 *
 * Mount this once near the app root. It's idempotent — additional mounts
 * just register additional listeners that all share the singleton store.
 */
export function useSessionLifecycle(): void {
  useEffect(() => {
    const refresh = useSessionStore.getState().refresh;
    void refresh();

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh();
      }
    };
    const onForcedSignOut = () => {
      useSessionStore.getState().setAnonymous();
    };
    const onChannelMessage = (e: MessageEvent<SessionBroadcast | undefined>) => {
      const data = e.data;
      if (!data || data.source === TAB_ID) return;
      // applyRemoteState mutates without re-broadcasting — prevents cross-tab
      // ping-pong where every tab keeps echoing the message it just received.
      void useSessionStore.getState().applyRemoteState(data.type);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(FORCED_SIGN_OUT_EVENT, onForcedSignOut);
    const ch = getChannel();
    ch?.addEventListener('message', onChannelMessage);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(FORCED_SIGN_OUT_EVENT, onForcedSignOut);
      ch?.removeEventListener('message', onChannelMessage);
    };
  }, []);
}
