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
  PendingBlockedResizeState,
  PendingDesignerUpdatedState,
  DimensionComparison,
  SyncEligibility,
  BinId,
  DesignId,
  SyncableDimensions,
} from '../types';
import type { ComplexityReason } from '../domain/complexGeometry';
import { syncDeclineKey } from '../domain/linkingRules';

interface LinkingStoreState {
  // Dialog states
  pendingSync: PendingSyncState | null;
  pendingDeleteWarning: PendingDeleteWarningState | null;
  pendingCreateDesign: PendingCreateDesignState | null;
  pendingLinkDesign: PendingLinkDesignState | null;
  pendingBlockedResize: PendingBlockedResizeState | null;
  pendingDesignerUpdated: PendingDesignerUpdatedState | null;

  /**
   * Sync prompts the user has already declined, as designId -> dimension key
   *. `useDesignSavedListener` re-reconciles on every mount, so without
   * this a design whose linked bins can't be resized re-opens the modal every
   * time the layout editor is returned to, with no way to say "I know".
   * Cleared implicitly: the key includes the dimensions, so changing the design
   * again asks afresh. Session-scoped on purpose — not persisted.
   */
  declinedSyncs: Record<string, string>;

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
  /** Record the open prompt as declined, then close it. */
  declineSyncDialog: () => void;

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
  showLinkDesignDialog: (binId: BinId, width: number, depth: number, height: number) => void;
  hideLinkDesignDialog: () => void;

  // Blocked resize dialog actions
  showBlockedResizeDialog: (
    binId: BinId,
    designId: DesignId,
    designName: string,
    reasons: ComplexityReason[]
  ) => void;
  hideBlockedResizeDialog: () => void;

  // Designer-updated dialog actions
  showDesignerUpdatedDialog: (designId: DesignId, designName: string) => void;
  hideDesignerUpdatedDialog: () => void;
}

export const useLinkingStore = create<LinkingStoreState>()((set) => ({
  // Initial states
  pendingSync: null,
  pendingDeleteWarning: null,
  pendingCreateDesign: null,
  pendingLinkDesign: null,
  pendingBlockedResize: null,
  pendingDesignerUpdated: null,
  declinedSyncs: {},

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
  declineSyncDialog: () =>
    set((state) =>
      state.pendingSync
        ? {
            pendingSync: null,
            declinedSyncs: {
              ...state.declinedSyncs,
              [state.pendingSync.designId]: syncDeclineKey(state.pendingSync.comparison.design),
            },
          }
        : { pendingSync: null }
    ),

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
  showLinkDesignDialog: (binId, width, depth, height) =>
    set({
      pendingLinkDesign: {
        binId,
        footprint: { width, depth },
        binHeight: height,
      },
    }),
  hideLinkDesignDialog: () => set({ pendingLinkDesign: null }),

  showBlockedResizeDialog: (binId, designId, designName, reasons) =>
    set({
      pendingBlockedResize: {
        binId,
        designId,
        designName,
        reasons,
      },
    }),
  hideBlockedResizeDialog: () => set({ pendingBlockedResize: null }),

  showDesignerUpdatedDialog: (designId, designName) =>
    set({
      pendingDesignerUpdated: { designId, designName },
    }),
  hideDesignerUpdatedDialog: () => set({ pendingDesignerUpdated: null }),
}));
