/**
 * Selection Pruning Event Subscriber
 *
 * Automatically removes stale references from the selection store when
 * bins, layers, or categories are deleted or moved to staging.
 *
 * This replaces manual `setSelectedBins([])` calls scattered across components
 * after delete/move operations. The subscriber reacts to domain events,
 * ensuring selection state is always consistent with layout state.
 *
 * Note: undo/redo bypasses CQRS (uses restoreLayout directly), so
 * pruneStaleSelections() in history.ts is still needed for that path.
 */

import type { UnsubscribeFn } from '../types';
import type { EventBus } from '../bus/eventBus';
import type { SelectionState } from '@/core/store/selection';
import type { BinId } from '@/core/types';
import { useSelectionStore } from '@/core/store/selection';
import { useLayoutStore } from '@/core/store/layout';
import { layerId, categoryId } from '@/core/types';

/**
 * Remove a single bin ID from selection state.
 * Clears focusedBinId and quickLabelBinId if they match the deleted bin.
 */
function removeBinFromSelection(id: BinId): void {
  const state = useSelectionStore.getState();
  const updates: Partial<SelectionState> = {};

  if (state.selectedBinIds.includes(id)) {
    updates.selectedBinIds = state.selectedBinIds.filter((binId) => binId !== id);
  }

  if (state.focusedBinId === id) {
    updates.focusedBinId = null;
  }

  if (state.quickLabelBinId === id) {
    updates.quickLabelBinId = null;
  }

  if (Object.keys(updates).length > 0) {
    state.restoreSelection(updates);
  }
}

/**
 * Remove multiple bin IDs from selection state.
 */
function removeBinsFromSelection(binIds: ReadonlyArray<BinId>): void {
  if (binIds.length === 0) return;

  const idSet = new Set<BinId>(binIds);
  const state = useSelectionStore.getState();
  const updates: Partial<SelectionState> = {};

  const filtered = state.selectedBinIds.filter((id) => !idSet.has(id));
  if (filtered.length !== state.selectedBinIds.length) {
    updates.selectedBinIds = filtered;
  }

  if (state.focusedBinId && idSet.has(state.focusedBinId)) {
    updates.focusedBinId = null;
  }

  if (state.quickLabelBinId && idSet.has(state.quickLabelBinId)) {
    updates.quickLabelBinId = null;
  }

  if (Object.keys(updates).length > 0) {
    state.restoreSelection(updates);
  }
}

/**
 * Connect selection pruning subscribers to the event bus.
 * Returns an unsubscribe function that removes all subscribers.
 */
export function connectSelectionPruning(bus: EventBus): UnsubscribeFn {
  const unsubscribers: UnsubscribeFn[] = [];

  // Single bin deleted
  unsubscribers.push(
    bus.subscribe('bin.deleted', (event) => {
      removeBinFromSelection(event.payload.bin.id);
    })
  );

  // Batch bin deletion
  unsubscribers.push(
    bus.subscribe('bin.batchDeleted', (event) => {
      removeBinsFromSelection(event.payload.bins.map((b) => b.id));
    })
  );

  // Layer cleared — all bins on that layer removed
  unsubscribers.push(
    bus.subscribe('bin.layerCleared', (event) => {
      removeBinsFromSelection(event.payload.bins.map((b) => b.id));
    })
  );

  // Bin moved to staging — no longer grid-selectable
  unsubscribers.push(
    bus.subscribe('bin.movedToStaging', (event) => {
      removeBinFromSelection(event.payload.id);
    })
  );

  // Layer deleted — reset active layer if it was the deleted one
  unsubscribers.push(
    bus.subscribe('layer.deleted', (event) => {
      const state = useSelectionStore.getState();
      if (state.activeLayerId === event.payload.layer.id) {
        const layout = useLayoutStore.getState().layout;
        if (layout.layers.length > 0) {
          state.restoreSelection({ activeLayerId: layout.layers[0].id });
        } else {
          state.restoreSelection({ activeLayerId: layerId('') });
        }
      }
    })
  );

  // Category deleted — reset active category if it was the deleted one
  unsubscribers.push(
    bus.subscribe('category.deleted', (event) => {
      const state = useSelectionStore.getState();
      if (state.activeCategoryId === event.payload.category.id) {
        const layout = useLayoutStore.getState().layout;
        if (layout.categories.length > 0) {
          state.restoreSelection({ activeCategoryId: layout.categories[0].id });
        } else {
          state.restoreSelection({ activeCategoryId: categoryId('') });
        }
      }
    })
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
