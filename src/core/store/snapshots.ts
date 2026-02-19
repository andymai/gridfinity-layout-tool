/**
 * Snapshot store — Manages in-memory snapshot state for the active layout.
 *
 * Snapshots are loaded from IndexedDB when switching layouts and updated
 * when auto-save creates new snapshots or the user labels/deletes them.
 */

import { create } from 'zustand';
import {
  createSnapshot as createSnapshotService,
  loadSnapshots as loadSnapshotsService,
  deleteSnapshot as deleteSnapshotService,
  updateSnapshotLabel as updateSnapshotLabelService,
} from '@/core/storage/SnapshotService';
import type { Layout, Snapshot } from '@/core/types';

export interface SnapshotState {
  /** Snapshots for the active layout, sorted newest-first */
  snapshots: Snapshot[];
  /** Whether snapshots are being loaded from IndexedDB */
  isLoading: boolean;
  /** Load snapshots for a layout (called on layout switch) */
  loadForLayout: (layoutId: string) => Promise<void>;
  /** Create a new snapshot and add to the list */
  addSnapshot: (layoutId: string, layout: Layout, label?: string) => Promise<void>;
  /** Delete a snapshot from both UI and IndexedDB */
  removeSnapshot: (snapshotId: string) => Promise<void>;
  /** Remove from UI state only (for optimistic delete with undo) */
  softRemove: (snapshotId: string) => void;
  /** Re-insert a snapshot into the list sorted by timestamp (for undo) */
  reinsert: (snapshot: Snapshot) => void;
  /** Update label on a snapshot */
  updateLabel: (snapshotId: string, label: string) => Promise<void>;
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: [],
  isLoading: false,

  loadForLayout: async (layoutId: string) => {
    set({ isLoading: true });
    try {
      const snapshots = await loadSnapshotsService(layoutId);
      set({ snapshots });
    } finally {
      set({ isLoading: false });
    }
  },

  addSnapshot: async (layoutId: string, layout: Layout, label?: string) => {
    await createSnapshotService(layoutId, layout, label);
    // Reload from IndexedDB to mirror any rolling-window evictions
    const snapshots = await loadSnapshotsService(layoutId);
    set({ snapshots });
  },

  removeSnapshot: async (snapshotId: string) => {
    await deleteSnapshotService(snapshotId);
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== snapshotId),
    }));
  },

  softRemove: (snapshotId: string) => {
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== snapshotId),
    }));
  },

  reinsert: (snapshot: Snapshot) => {
    set((state) => {
      const updated = [...state.snapshots, snapshot].sort((a, b) => b.timestamp - a.timestamp);
      return { snapshots: updated };
    });
  },

  updateLabel: async (snapshotId: string, label: string) => {
    await updateSnapshotLabelService(snapshotId, label);
    set((state) => ({
      snapshots: state.snapshots.map((s) => (s.id === snapshotId ? { ...s, label } : s)),
    }));
  },
}));
