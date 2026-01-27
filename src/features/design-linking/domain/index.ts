/**
 * Domain layer - pure business logic for design linking.
 *
 * Re-exports all domain functions for convenient importing.
 */

// Linking rules and validation
export {
  dimensionsMatch,
  compareDimensions,
  checkSyncEligibility,
  checkBatchSyncEligibility,
  generateDefaultDesignName,
} from './linkingRules';

// Sync operations and transformations
export {
  extractBinDimensions,
  extractDesignDimensions,
  createBinSyncUpdate,
  formatDimension,
  formatDimensions,
  formatDimensionChange,
} from './syncOperations';

// Linkage queries
export {
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
} from './linkageQueries';
