import { create } from 'zustand';

interface PWAUpdateState {
  /** A new version is installed and waiting for a reload. */
  updateReady: boolean;
  /**
   * Applies the pending update. Owned by `usePWAUpdate`, which is the only
   * place that knows how to persist UI state and hand off to the new worker.
   * Calling it bypasses the idle checks: an explicit click is unambiguous.
   */
  applyUpdate: (() => void) | null;
  announceUpdate: (apply: () => void) => void;
  clearUpdate: () => void;
}

/**
 * Surfaces a pending PWA update to the sidebar. Separate from the toast system
 * on purpose: this state persists until the user acts or the safety net applies
 * the update, and a toast that never leaves is a notification in the wrong shape.
 */
export const usePWAUpdateStore = create<PWAUpdateState>((set) => ({
  updateReady: false,
  applyUpdate: null,
  announceUpdate: (apply) => set({ updateReady: true, applyUpdate: apply }),
  clearUpdate: () => set({ updateReady: false, applyUpdate: null }),
}));
