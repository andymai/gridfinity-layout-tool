/**
 * Public types and small helpers shared across the bin-inspector hook
 * surface (`useBinInspector`, `useBinInspectorMultiActions`).
 *
 * Splitting these out keeps the main hook file under the line cap and
 * lets the multi-action hook import only what it needs.
 */

import type { Bin, Category, Layer, Layout } from '@/core/types';
import { emitSyncEvent } from '@/shared/events/syncEventBus';

export type BinField =
  | 'width'
  | 'depth'
  | 'height'
  | 'clearanceHeight'
  | 'category'
  | 'label'
  | 'notes';

export type MinHeightReason = 'layer_height' | 'global_minimum';
export type MaxHeightReason = 'remaining_space' | 'drawer_height';

export interface BinConstraints {
  minHeight: number;
  maxHeight: number;
  maxClearance: number;
  maxGridUnits: { width: number; depth: number };
  needsSplit: boolean;
  heightRange: string;
  /** Why the minimum height is what it is */
  minHeightReason: MinHeightReason;
  /** Why the maximum height is what it is */
  maxHeightReason: MaxHeightReason;
}

export interface ConfirmDeleteState {
  title: string;
  message: string;
}

export interface UseBinInspectorReturn {
  selectedBins: Bin[];
  isMultiSelect: boolean;
  bin: Bin | null;
  category: Category | null;
  layer: Layer | null;

  // Constraints (derived)
  constraints: BinConstraints;

  updateField: (field: BinField, value: string | number) => void;
  updateCustomProperties: (properties: Record<string, string>) => void;
  updateMultiCustomProperty: (key: string, value: string) => void;
  updateMultiCategory: (categoryId: string) => void;
  updateMultiHeight: (delta: number) => void;
  updateMultiClearance: (delta: number) => void;

  moveToLayer: (targetLayerId: string) => void;
  updateMultiLayer: (targetLayerId: string) => void;

  requestDelete: () => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  moveToStaging: () => void;
  clearSelection: () => void;
  rotateBin: () => boolean;
  applySuggestedSize: (size: { width: number; depth: number; height: number }) => boolean;
  canApplySuggestedSize: (size: { width: number; depth: number; height: number }) => boolean;

  deleteConfirmState: ConfirmDeleteState | null;

  layout: Layout;
  categories: Category[];
  /** All unique custom property keys used across all bins in the layout */
  existingPropertyKeys: string[];
}

/** Emit a bin-resized sync event if the bin is linked and dimensions changed. */
export function emitLinkedBinResize(
  bin: Bin,
  newDimensions: { width: number; depth: number; height: number }
): void {
  if (!bin.linkedDesignId) return;
  if (
    newDimensions.width === bin.width &&
    newDimensions.depth === bin.depth &&
    newDimensions.height === bin.height
  ) {
    return;
  }
  emitSyncEvent({
    type: 'bin-resized',
    binId: bin.id,
    linkedDesignId: bin.linkedDesignId,
    newDimensions,
  });
}
