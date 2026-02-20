/**
 * Design-to-bin linking domain types.
 *
 * Defines the contract between bin-designer and layout-planner features.
 * Enables one-to-many linking where multiple bins can reference a single design.
 */

/** Unique identifier for a saved design (from bin-designer IndexedDB) */
export type DesignId = string;

/** Re-export branded BinId from core types for type safety */
import type { BinId } from '@/core/types';
export type { BinId };

// =============================================================================
// Dimension Types
// =============================================================================

/** Dimensions that can be synced between design and bin */
export interface SyncableDimensions {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/** Result of comparing design dimensions to bin dimensions */
export interface DimensionComparison {
  /** True if all dimensions match within tolerance */
  readonly matched: boolean;
  /** Design dimensions */
  readonly design: SyncableDimensions;
  /** Bin dimensions */
  readonly bin: SyncableDimensions;
  /** Which dimensions differ */
  readonly differences: {
    readonly width: boolean;
    readonly depth: boolean;
    readonly height: boolean;
  };
}

// =============================================================================
// Sync Types
// =============================================================================

/** Direction of dimension sync */
export type SyncDirection = 'design-to-bin' | 'bin-to-design';

/** Reasons a design has complex geometry (used in BlockedResizeDialog) */
import type { ComplexityReason } from '../domain/complexGeometry';
export type { ComplexityReason };

/** State for the blocked resize dialog */
export interface PendingBlockedResizeState {
  readonly binId: BinId;
  readonly designId: DesignId;
  readonly designName: string;
  readonly reasons: ComplexityReason[];
}

/** Result of sync eligibility check for a bin */
export interface SyncEligibility {
  /** Bin ID */
  readonly binId: BinId;
  /** Whether this bin can be synced (dimensions fit in current position) */
  readonly canSync: boolean;
  /** If canSync is false, why not */
  readonly blockReason?: 'out_of_bounds' | 'collision';
}

/** Batch sync result */
export interface SyncResult {
  /** Bins that were successfully synced */
  readonly synced: BinId[];
  /** Bins that were unlinked due to fit issues */
  readonly unlinked: BinId[];
  /** Total bins that were linked before sync attempt */
  readonly totalLinked: number;
}

// =============================================================================
// Linking Operation Types
// =============================================================================

/** Types of linking operations for tracking/analytics */
export type LinkingOperationType =
  | 'link'
  | 'unlink'
  | 'sync'
  | 'create-from-bin'
  | 'edit-design'
  | 'place-from-palette';

/** Entry point where linking operation was initiated */
export type LinkingEntryPoint = 'context-menu' | 'inspector' | 'custom-bins-palette';

// =============================================================================
// UI State Types
// =============================================================================

/** State for the sync dimensions dialog */
export interface PendingSyncState {
  /** Bins to potentially sync */
  readonly binIds: BinId[];
  /** Design being synced from */
  readonly designId: DesignId;
  /** Design name for display */
  readonly designName: string;
  /** Comparison showing dimension differences (uses first bin) */
  readonly comparison: DimensionComparison;
  /** Eligibility for each bin */
  readonly eligibility: SyncEligibility[];
  /** True if selected bins have varying dimensions */
  readonly binsHaveVaryingDimensions: boolean;
}

/** State for the delete warning dialog */
export interface PendingDeleteWarningState {
  /** Design being deleted */
  readonly designId: DesignId;
  /** Design name for display */
  readonly designName: string;
  /** Bins linked to this design */
  readonly linkedBinIds: BinId[];
  /** Callback when user confirms deletion */
  readonly onConfirm: () => void;
  /** Callback when user cancels */
  readonly onCancel: () => void;
}

/** State for the create design dialog */
export interface PendingCreateDesignState {
  /** Bin to create design from */
  readonly binId: BinId;
  /** Default name (dimension-based) */
  readonly defaultName: string;
  /** Bin label if present (for optional use) */
  readonly binLabel?: string;
  /** Bin dimensions */
  readonly dimensions: SyncableDimensions;
}

/** State for the designer-updated notification dialog */
export interface PendingDesignerUpdatedState {
  /** Design that was updated */
  readonly designId: DesignId;
  /** Design name for display */
  readonly designName: string;
}

/** State for the link existing design dialog */
export interface PendingLinkDesignState {
  /** Bin to link a design to */
  readonly binId: BinId;
  /** Bin footprint for filtering compatible designs */
  readonly footprint: {
    readonly width: number;
    readonly depth: number;
  };
  /** Bin height for mismatch warning display */
  readonly binHeight: number;
}

// =============================================================================
// Summary Types
// =============================================================================

/** Summary of bins linked to a specific design */
export interface DesignLinkedBinsSummary {
  readonly designId: DesignId;
  readonly designName: string;
  readonly linkedBinCount: number;
  readonly linkedBinIds: BinId[];
  /** True if any linked bin has dimensions that don't match the design */
  readonly hasDimensionMismatch: boolean;
}
