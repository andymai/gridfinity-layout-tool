/**
 * Pure builder for the cutout workspace's right-click context menu.
 *
 * Returns a list of `ContextMenuAction`s tailored to the current selection
 * and clipboard state. The component memoizes the call so the menu only
 * rebuilds when its inputs change.
 */

import type { ContextMenuAction } from '../panel/CutoutsSection/CutoutContextMenu';
import {
  centerInBin,
  flipSelectionHorizontal,
  flipSelectionVertical,
} from '../panel/CutoutsSection/geometry';
import type { Cutout } from '@/features/bin-designer/types';
import type { TFunction } from '@/i18n/context';

interface BuildContextActionsArgs {
  selection: ReadonlySet<string>;
  clipboard: ReadonlyArray<unknown>;
  cutouts: Cutout[];
  binWidth: number;
  binDepth: number;
  copySelected: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  pasteFromClipboard: () => void;
  selectAll: () => void;
  updateCutout: (id: string, patch: Partial<Cutout>) => void;
  updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  lockCutouts: (ids: string[]) => void;
  unlockCutouts: (ids: string[]) => void;
  t: TFunction;
}

export function buildCutoutContextActions(args: BuildContextActionsArgs): ContextMenuAction[] {
  const {
    selection,
    clipboard,
    cutouts,
    binWidth,
    binDepth,
    copySelected,
    duplicateSelected,
    deleteSelected,
    pasteFromClipboard,
    selectAll,
    updateCutout,
    updateCutoutsBatch,
    lockCutouts,
    unlockCutouts,
    t,
  } = args;

  const hasSelection = selection.size > 0;
  const hasClipboard = clipboard.length > 0;
  const actions: ContextMenuAction[] = [];

  if (hasSelection) {
    actions.push({
      label: t('common.copy'),
      onClick: copySelected,
      shortcut: { keys: 'C', modifier: true },
    });
    actions.push({
      label: t('common.duplicate'),
      onClick: duplicateSelected,
      shortcut: { keys: 'D', modifier: true },
    });
    actions.push({
      label: t('common.delete'),
      onClick: deleteSelected,
      danger: true,
      dividerAfter: true,
      shortcut: { keys: 'Del' },
    });
  }

  actions.push({
    label: t('binDesigner.cutouts.paste'),
    onClick: pasteFromClipboard,
    disabled: !hasClipboard,
    shortcut: { keys: 'V', modifier: true },
  });

  actions.push({
    label: t('binDesigner.cutouts.selectAll'),
    onClick: selectAll,
    dividerAfter: hasSelection && selection.size < cutouts.length,
    shortcut: { keys: 'A', modifier: true },
  });

  if (hasSelection && selection.size === 1) {
    const cutout = cutouts.find((c) => selection.has(c.id));
    if (cutout) {
      actions.push({
        label: t('binDesigner.cutouts.rotate90'),
        onClick: () => {
          const newRotation = (cutout.rotation + 90) % 360;
          updateCutout(cutout.id, { rotation: newRotation });
        },
        shortcut: { keys: 'R' },
      });
    }
  }

  if (hasSelection) {
    const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
    const anyLocked = selectedCutouts.some((c) => c.locked);

    actions.push({
      label: t('binDesigner.cutouts.flipHorizontal'),
      onClick: () => {
        const updates = flipSelectionHorizontal(selectedCutouts);
        if (updates.size > 1) {
          updateCutoutsBatch(updates);
        } else {
          for (const [id, patch] of updates) {
            updateCutout(id, patch);
          }
        }
      },
      disabled: anyLocked,
      shortcut: { keys: 'H', shift: true },
    });

    actions.push({
      label: t('binDesigner.cutouts.flipVertical'),
      onClick: () => {
        const updates = flipSelectionVertical(selectedCutouts);
        if (updates.size > 1) {
          updateCutoutsBatch(updates);
        } else {
          for (const [id, patch] of updates) {
            updateCutout(id, patch);
          }
        }
      },
      disabled: anyLocked,
      shortcut: { keys: 'V', shift: true },
    });
  }

  if (hasSelection) {
    actions.push({
      label: t('binDesigner.cutouts.centerInBin'),
      onClick: () => {
        const selected = cutouts.filter((c) => selection.has(c.id));
        const positions = centerInBin(selected, binWidth, binDepth);
        for (const [id, pos] of Object.entries(positions)) {
          updateCutout(id, pos);
        }
      },
      dividerAfter: true,
    });

    // Lock/hide/layer ordering
    const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
    const allLocked = selectedCutouts.every((c) => c.locked);

    actions.push({
      label: allLocked ? t('binDesigner.cutoutEditor.unlock') : t('binDesigner.cutoutEditor.lock'),
      onClick: () => {
        const ids = [...selection];
        if (allLocked) unlockCutouts(ids);
        else lockCutouts(ids);
      },
      shortcut: { keys: 'L', modifier: true },
    });
  }

  return actions;
}
