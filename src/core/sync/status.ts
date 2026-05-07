import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

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

export const useSyncStatusStore = create<SyncStatus & SyncStatusActions>()(
  immer((set) => ({
    state: 'idle',
    pendingCount: 0,
    beginSync: () =>
      set((draft) => {
        if (draft.state !== 'syncing') draft.state = 'syncing';
      }),
    succeed: () =>
      set((draft) => {
        // Single coherent transition: stay 'syncing' while the outbox still
        // has work, otherwise return to 'idle'. Avoids per-item flicker.
        draft.state = draft.pendingCount > 0 ? 'syncing' : 'idle';
        draft.lastSyncedAt = Date.now();
        draft.lastError = undefined;
      }),
    reportOffline: (message) =>
      set((draft) => {
        draft.state = 'offline';
        draft.lastError = message;
      }),
    reportError: (message) =>
      set((draft) => {
        draft.state = 'error';
        draft.lastError = message;
      }),
    setPendingCount: (count) =>
      set((draft) => {
        draft.pendingCount = Math.max(0, count);
      }),
    reset: () =>
      set((draft) => {
        draft.state = 'idle';
        draft.pendingCount = 0;
        draft.lastSyncedAt = undefined;
        draft.lastError = undefined;
      }),
  }))
);
