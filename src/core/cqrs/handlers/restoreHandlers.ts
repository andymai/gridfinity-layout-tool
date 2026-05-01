/**
 * Restore Command Handlers
 *
 * Centralizes layout restoration and related side effects (selection
 * snapshot/prune). Dispatched by useHistoryStore.undo/redo via the
 * command bus.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import type { SelectionState } from '@/core/store/selection';
import { ok } from '@/core/result';
import type { Layout, BinId, LayerId, CategoryId } from '@/core/types';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import type { RestoreLayoutCommand } from '../commands';
import type { SelectionSnapshot } from '../undo/historyStore';
import { createEventMeta } from './shared';

/**
 * Fallback active-layer id when the restored layout no longer contains the
 * snapshotted/current id: use the last layer in data order (= top layer in
 * the UI, since the UI reverses via getDisplayLayers()). New bins typically
 * land on the top layer, so this is the least-surprising fallback.
 */
function fallbackActiveLayerId(restoredLayout: Layout): LayerId {
  return restoredLayout.layers[restoredLayout.layers.length - 1].id;
}

/**
 * Apply a captured selection snapshot to the restored layout, reconciling
 * any IDs that no longer exist (same fallbacks as the prune path).
 */
function applySnapshot(layout: Layout, snapshot: SelectionSnapshot): Partial<SelectionState> {
  const binIds = new Set(layout.bins.map((b) => b.id));
  const layerIds = new Set(layout.layers.map((l) => l.id));
  const categoryIds = new Set(layout.categories.map((c) => c.id));

  const activeLayerId =
    layerIds.has(snapshot.activeLayerId) || layout.layers.length === 0
      ? snapshot.activeLayerId
      : fallbackActiveLayerId(layout);

  const activeCategoryId =
    categoryIds.has(snapshot.activeCategoryId) || layout.categories.length === 0
      ? snapshot.activeCategoryId
      : layout.categories[0].id;

  return {
    activeLayerId,
    activeCategoryId,
    selectedBinIds: snapshot.selectedBinIds.filter((id) => binIds.has(id)),
    focusedBinId:
      snapshot.focusedBinId && binIds.has(snapshot.focusedBinId) ? snapshot.focusedBinId : null,
    quickLabelBinId:
      snapshot.quickLabelBinId && binIds.has(snapshot.quickLabelBinId)
        ? snapshot.quickLabelBinId
        : null,
  };
}

/**
 * Prune stale selection IDs against the restored layout. Used when no
 * snapshot is provided (e.g. an external caller, or pre-snapshot history
 * entries).
 */
function pruneSelection(layout: Layout, current: SelectionState): Partial<SelectionState> {
  const binIds = new Set<BinId>(layout.bins.map((b) => b.id));
  const layerIds = new Set<LayerId>(layout.layers.map((l) => l.id));
  const categoryIds = new Set<CategoryId>(layout.categories.map((c) => c.id));

  const pruned: Partial<SelectionState> = {};

  const validBins = current.selectedBinIds.filter((id) => binIds.has(id));
  if (validBins.length !== current.selectedBinIds.length) {
    pruned.selectedBinIds = validBins;
  }

  if (current.focusedBinId && !binIds.has(current.focusedBinId)) {
    pruned.focusedBinId = null;
  }

  if (current.quickLabelBinId && !binIds.has(current.quickLabelBinId)) {
    pruned.quickLabelBinId = null;
  }

  if (!layerIds.has(current.activeLayerId) && layout.layers.length > 0) {
    pruned.activeLayerId = fallbackActiveLayerId(layout);
  }

  if (!categoryIds.has(current.activeCategoryId) && layout.categories.length > 0) {
    pruned.activeCategoryId = layout.categories[0].id;
  }

  return pruned;
}

export function handleRestoreLayout(
  command: RestoreLayoutCommand
): CommandResult<void, DomainEvent> {
  const { layout, direction, selection: snapshot } = command.payload;

  useLayoutStore.getState().restoreLayout(layout);

  const selection = useSelectionStore.getState();
  const updates = snapshot ? applySnapshot(layout, snapshot) : pruneSelection(layout, selection);

  if (Object.keys(updates).length > 0) {
    selection.restoreSelection(updates);
  }

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.restored' as const,
        payload: { direction },
        meta: createEventMeta(command.meta, 'layout.restored'),
      },
    ],
  });
}

export const restoreHandlers = {
  'layout.restore': handleRestoreLayout,
} as const;
