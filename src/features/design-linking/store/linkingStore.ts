/**
 * Linking store - transient UI state for linking operations.
 *
 * This store manages ephemeral dialog states (sync confirmation, delete warning).
 * Actual linking data (linkedDesignId) lives in the layout store on bins.
 */

import { create } from 'zustand';
import type {
  PendingSyncState,
  PendingDeleteWarningState,
  PendingCreateDesignState,
  PendingLinkDesignState,
  DimensionComparison,
  SyncEligibility,
  BinId,
  DesignId,
  SyncableDimensions,
} from '../types';

interface LinkingStoreState {
  // Dialog states
  pendingSync: PendingSyncState | null;
  pendingDeleteWarning: PendingDeleteWarningState | null;
  pendingCreateDesign: PendingCreateDesignState | null;
  pendingLinkDesign: PendingLinkDesignState | null;

  // Sync dialog actions
  showSyncDialog: (
    binIds: BinId[],
    designId: DesignId,
    designName: string,
    comparison: DimensionComparison,
    eligibility: SyncEligibility[],
    binsHaveVaryingDimensions: boolean
  ) => void;
  hideSyncDialog: () => void;

  // Delete warning actions
  showDeleteWarning: (
    designId: DesignId,
    designName: string,
    linkedBinIds: BinId[],
    onConfirm: () => void,
    onCancel: () => void
  ) => void;
  hideDeleteWarning: () => void;

  // Create design dialog actions
  showCreateDesignDialog: (
    binId: BinId,
    defaultName: string,
    dimensions: SyncableDimensions,
    binLabel?: string
  ) => void;
  hideCreateDesignDialog: () => void;

  // Link existing design dialog actions
  showLinkDesignDialog: (binId: BinId, width: number, depth: number) => void;
  hideLinkDesignDialog: () => void;
}

export const useLinkingStore = create<LinkingStoreState>()((set) => ({
  // Initial states
  pendingSync: null,
  pendingDeleteWarning: null,
  pendingCreateDesign: null,
  pendingLinkDesign: null,

  // Sync dialog
  showSyncDialog: (
    binIds,
    designId,
    designName,
    comparison,
    eligibility,
    binsHaveVaryingDimensions
  ) =>
    set({
      pendingSync: {
        binIds,
        designId,
        designName,
        comparison,
        eligibility,
        binsHaveVaryingDimensions,
      },
    }),
  hideSyncDialog: () => set({ pendingSync: null }),

  // Delete warning
  showDeleteWarning: (designId, designName, linkedBinIds, onConfirm, onCancel) =>
    set({
      pendingDeleteWarning: {
        designId,
        designName,
        linkedBinIds,
        onConfirm,
        onCancel,
      },
    }),
  hideDeleteWarning: () => set({ pendingDeleteWarning: null }),

  // Create design dialog
  showCreateDesignDialog: (binId, defaultName, dimensions, binLabel) =>
    set({
      pendingCreateDesign: {
        binId,
        defaultName,
        dimensions,
        binLabel,
      },
    }),
  hideCreateDesignDialog: () => set({ pendingCreateDesign: null }),

  // Link existing design dialog
  showLinkDesignDialog: (binId, width, depth) =>
    set({
      pendingLinkDesign: {
        binId,
        footprint: { width, depth },
      },
    }),
  hideLinkDesignDialog: () => set({ pendingLinkDesign: null }),
}));
