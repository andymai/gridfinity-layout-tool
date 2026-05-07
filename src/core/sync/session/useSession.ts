import { create } from 'zustand';
import { useEffect } from 'react';
import { FORCED_SIGN_OUT_EVENT } from '../apiFetch';
import { getMe, type SessionUser } from './sessionApi';

export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  setAuthenticated: (user: SessionUser) => void;
  setAnonymous: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'unknown',
  user: null,
  refresh: async () => {
    try {
      const user = await getMe();
      if (user) {
        set({ status: 'authenticated', user });
        broadcastSessionChange('authenticated');
      } else {
        set({ status: 'anonymous', user: null });
        broadcastSessionChange('anonymous');
      }
    } catch {
      // Network error during refresh: don't mutate state. Better to stay
      // 'unknown' and re-try on next visibility flip than to spuriously
      // sign the user out.
    }
  },
  setAuthenticated: (user) => {
    set({ status: 'authenticated', user });
    broadcastSessionChange('authenticated');
  },
  setAnonymous: () => {
    set({ status: 'anonymous', user: null });
    broadcastSessionChange('anonymous');
  },
}));

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
      if (data.type === 'authenticated') void refresh();
      else useSessionStore.getState().setAnonymous();
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
