/**
 * Restore Command Handlers
 *
 * Centralizes layout restoration and related side effects (e.g., selection
 * pruning) so that, once wired up, history.ts can dispatch a restore command
 * instead of calling restoreLayout() directly. Currently not yet wired —
 * history.ts still restores directly.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import type { SelectionState } from '@/core/store/selection';
import { ok } from '@/core/result';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import type { RestoreLayoutCommand } from '../commands';
import { createEventMeta } from './shared';

export function handleRestoreLayout(
  command: RestoreLayoutCommand
): CommandResult<void, DomainEvent> {
  useLayoutStore.getState().restoreLayout(command.payload.layout);

  // Prune stale selections (bins/layers/categories that no longer exist)
  const { layout } = command.payload;
  const selection = useSelectionStore.getState();
  const binIds = new Set(layout.bins.map((b) => b.id));
  const layerIds = new Set(layout.layers.map((l) => l.id));
  const categoryIds = new Set(layout.categories.map((c) => c.id));

  const pruned: Partial<SelectionState> = {};

  const validBins = selection.selectedBinIds.filter((id) => binIds.has(id));
  if (validBins.length !== selection.selectedBinIds.length) {
    pruned.selectedBinIds = validBins;
  }

  if (selection.focusedBinId && !binIds.has(selection.focusedBinId)) {
    pruned.focusedBinId = null;
  }

  if (selection.quickLabelBinId && !binIds.has(selection.quickLabelBinId)) {
    pruned.quickLabelBinId = null;
  }

  // Fall back to last layer (top in UI, since layers[0] is bottom)
  if (!layerIds.has(selection.activeLayerId) && layout.layers.length > 0) {
    pruned.activeLayerId = layout.layers[layout.layers.length - 1].id;
  }

  if (!categoryIds.has(selection.activeCategoryId) && layout.categories.length > 0) {
    pruned.activeCategoryId = layout.categories[0].id;
  }

  if (Object.keys(pruned).length > 0) {
    selection.restoreSelection(pruned);
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
