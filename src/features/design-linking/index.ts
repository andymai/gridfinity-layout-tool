/**
 * Design Linking Feature
 *
 * Provides bidirectional integration between the Bin Designer and Layout Planner.
 * Enables bins in layouts to be linked to saved designs for synchronized dimensions.
 *
 * Key capabilities:
 * - Link/unlink bins to saved designs (one-to-many)
 * - Navigate from planner to designer to edit linked design
 * - Create new designs from existing bins
 * - Sync dimensions from design to linked bins
 * - Link existing designs to bins via picker dialog
 *
 * @module design-linking
 */

export type {
  DesignId,
  BinId,
  SyncableDimensions,
  DimensionComparison,
  SyncDirection,
  SyncEligibility,
  SyncResult,
  LinkingOperationType,
  LinkingEntryPoint,
  PendingSyncState,
  PendingDeleteWarningState,
  PendingCreateDesignState,
  PendingLinkDesignState,
  DesignLinkedBinsSummary,
} from './types';

// Domain (pure functions)
export {
  // Linking rules
  dimensionsMatch,
  compareDimensions,
  checkSyncEligibility,
  checkBatchSyncEligibility,
  generateDefaultDesignName,
  // Sync operations
  extractBinDimensions,
  extractDesignDimensions,
  createBinSyncUpdate,
  formatDimension,
  formatDimensions,
  formatDimensionChange,
  // Linkage queries
  getLinkedDesignId,
  isLinked,
  isLinkedTo,
  getBinsLinkedToDesign,
  getBinIdsLinkedToDesign,
  hasLinkedBins,
  countLinkedBins,
  getLinkedDesignIds,
  getLinkedBins,
  binMatchesDesign,
  getBinsWithDimensionMismatch,
  buildLinkedBinsSummary,
  resolveLinkedDesign,
  linkedDesignExists,
} from './domain';

// Store
export { useLinkingStore } from './store';

export { useBinLinking, useLinkedDesign, useLinkedBins } from './hooks';

export {
  CreateDesignDialog,
  SyncDimensionsDialog,
  DeleteDesignWarningDialog,
  LinkedDesignSection,
  DesignLinkingDialogs,
} from './components';
