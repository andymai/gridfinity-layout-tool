/**
 * Restore Command Handlers
 *
 * Handles undo/redo layout restoration through the CQRS pipeline.
 * Replaces the direct restoreLayout() call in history.ts, ensuring
 * that restore operations emit events for subscribers to react to
 * (e.g., selection pruning, design-linking reconciliation).
 */

import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { ok } from '@/core/result';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import type { RestoreLayoutCommand } from '../commands';
import { createEventMeta } from './shared';

export function handleRestoreLayout(
  command: RestoreLayoutCommand
): CommandResult<void, DomainEvent> {
  // Restore the layout state
  useLayoutStore.getState().restoreLayout(command.payload.layout);

  // Prune stale selections (bins/layers/categories that no longer exist)
  const restoredLayout = command.payload.layout;
  const selectionState = useSelectionStore.getState();
  const binIds = new Set(restoredLayout.bins.map((b) => b.id));
  const layerIds = new Set(restoredLayout.layers.map((l) => l.id));
  const categoryIds = new Set(restoredLayout.categories.map((c) => c.id));

  const prunedSelection: Record<string, unknown> = {};

  const validBins = selectionState.selectedBinIds.filter((id) => binIds.has(id));
  if (validBins.length !== selectionState.selectedBinIds.length) {
    prunedSelection.selectedBinIds = validBins;
  }

  if (selectionState.focusedBinId && !binIds.has(selectionState.focusedBinId)) {
    prunedSelection.focusedBinId = null;
  }

  if (selectionState.quickLabelBinId && !binIds.has(selectionState.quickLabelBinId)) {
    prunedSelection.quickLabelBinId = null;
  }

  if (!layerIds.has(selectionState.activeLayerId) && restoredLayout.layers.length > 0) {
    prunedSelection.activeLayerId = restoredLayout.layers[0].id;
  }

  if (!categoryIds.has(selectionState.activeCategoryId) && restoredLayout.categories.length > 0) {
    prunedSelection.activeCategoryId = restoredLayout.categories[0].id;
  }

  if (Object.keys(prunedSelection).length > 0) {
    selectionState.restoreSelection(prunedSelection);
  }

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.restored' as const,
        payload: { direction: command.payload.direction },
        meta: createEventMeta(command.meta, 'layout.restored'),
      },
    ],
  });
}

export const restoreHandlers = {
  'layout.restore': handleRestoreLayout,
} as const;
