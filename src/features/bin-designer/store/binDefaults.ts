/**
 * Reactive mirror of "is a custom default-for-new-bins stored?".
 *
 * The default itself lives in localStorage (`defaultParamsStorage`), which is
 * not reactive. This tiny store lets every surface that shows the
 * custom-default state — the Saved Designs ⋯ menu, the parameter-panel
 * footer hint, and the Settings tab — stay in sync when the value is set or
 * cleared from any of them (or via the command palette).
 *
 * Source of truth remains localStorage; this store is kept in lockstep by
 * `useBinDefaults` and re-synced from storage via `refresh()`.
 */

import { create } from 'zustand';
import { hasCustomDefault } from '../storage/defaultParamsStorage';

interface BinDefaultsState {
  /** Whether a custom default for new bins is currently stored. */
  hasCustomDefault: boolean;
  /** Mark a custom default as saved (after a successful write). */
  markSaved: () => void;
  /** Mark the custom default as cleared (after reset to factory). */
  markCleared: () => void;
  /** Re-read the flag from storage (e.g. after cross-tab changes). */
  refresh: () => void;
}

export const useBinDefaultsStore = create<BinDefaultsState>((set) => ({
  hasCustomDefault: hasCustomDefault(),
  markSaved: () => set({ hasCustomDefault: true }),
  markCleared: () => set({ hasCustomDefault: false }),
  refresh: () => set({ hasCustomDefault: hasCustomDefault() }),
}));
