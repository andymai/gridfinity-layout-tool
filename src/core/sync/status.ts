import { create } from 'zustand';

/**
 * High-level sync state for the UI.
 *
 *   idle     — outbox empty, no in-flight push or pull
 *   syncing  — at least one push or pull in flight
 *   offline  — last network attempt failed; outbox waiting for connectivity
 *   error    — last attempt failed for a reason other than network
 *              (quota exceeded, permanent push give-up, etc.)
 *
 * The Settings → Account panel (PR 6) reads this directly; the
 * trigger hooks surface toast notifications based on transitions.
 * No header indicator — see `docs/plans/multi-device-sync.md`.
 */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  /** Last successful manifest pull or successful push. */
  lastSyncedAt?: number;
  /** How many entries the outbox is currently holding. */
  pendingCount: number;
  /** Most recent error message; cleared on next successful sync. */
  lastError?: string;
}

interface SyncStatusActions {
  /** Engine signals it started a push or pull; idempotent. */
  beginSync: () => void;
  /** Engine signals success; updates `lastSyncedAt` and clears `lastError`. */
  succeed: () => void;
  /** Engine reports a network failure (timeout, offline, 5xx). */
  reportOffline: (message?: string) => void;
  /**
   * Engine reports a non-network failure (quota, give-up, schema mismatch).
   * Distinct from offline so the UI can show different copy.
   */
  reportError: (message: string) => void;
  /** Outbox count changed (called by the drainer / on enqueue). */
  setPendingCount: (count: number) => void;
  /** Drop everything — used on sign-out. */
  reset: () => void;
}

const INITIAL: SyncStatus = {
  state: 'idle',
  pendingCount: 0,
};

export const useSyncStatusStore = create<SyncStatus & SyncStatusActions>((set) => ({
  ...INITIAL,
  beginSync: () => set((s) => (s.state === 'syncing' ? s : { ...s, state: 'syncing' })),
  succeed: () =>
    set((s) => ({
      state: s.pendingCount > 0 ? 'syncing' : 'idle',
      lastSyncedAt: Date.now(),
      pendingCount: s.pendingCount,
      lastError: undefined,
    })),
  reportOffline: (message) =>
    set((s) => ({
      ...s,
      state: 'offline',
      lastError: message,
    })),
  reportError: (message) =>
    set((s) => ({
      ...s,
      state: 'error',
      lastError: message,
    })),
  setPendingCount: (count) =>
    set((s) => ({
      ...s,
      pendingCount: Math.max(0, count),
    })),
  reset: () =>
    set({
      ...INITIAL,
      lastError: undefined,
      lastSyncedAt: undefined,
    }),
}));
