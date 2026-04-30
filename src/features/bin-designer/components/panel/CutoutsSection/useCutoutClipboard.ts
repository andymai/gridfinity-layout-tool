/**
 * Clipboard sub-hook for cutout copy/paste/duplicate.
 *
 * Owns the clipboard array and paste-counter ref. Exposes copy/paste/duplicate
 * handlers that integrate with the toast system and respect polygon mask
 * constraints.
 */

import { useCallback, useRef, useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { MaskCellSize } from './maskFit';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { cutoutFitsInMask } from './maskFit';
import { addClonedCutouts, clampedOffset } from './cutoutHelpers';
import { PASTE_OFFSET } from './cutoutInteractionTypes';

interface UseCutoutClipboardOptions {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly setSelection: (sel: ReadonlySet<string>) => void;
  readonly onAdd: (cutout: Cutout) => void;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly cellMask?: CellMask;
  readonly maskCellSize?: MaskCellSize;
}

export interface CutoutClipboard {
  readonly clipboard: readonly Cutout[];
  readonly copySelected: () => void;
  readonly pasteFromClipboard: () => void;
  readonly duplicateSelected: () => void;
}

export function useCutoutClipboard({
  cutouts,
  selection,
  setSelection,
  onAdd,
  binWidth,
  binDepth,
  cellMask,
  maskCellSize,
}: UseCutoutClipboardOptions): CutoutClipboard {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();
  const [clipboard, setClipboard] = useState<readonly Cutout[]>([]);
  const pasteCountRef = useRef(0);

  const copySelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length > 0) {
      setClipboard(selected);
      pasteCountRef.current = 0;
      addToast({
        message: t('toast.cutoutsCopied', { count: selected.length }),
        type: 'info',
        duration: 2000,
      });
    }
  }, [cutouts, selection, addToast, t]);

  const pasteFromClipboard = useCallback(() => {
    if (clipboard.length === 0) return;
    pasteCountRef.current += 1;
    const offset = PASTE_OFFSET * pasteCountRef.current;

    // Polygon bins: drop originals whose offset clone would overhang the mask.
    // User can re-paste at a different location rather than losing the clipboard.
    const placeable =
      cellMask && maskCellSize
        ? clipboard.filter((orig) => {
            const pos = clampedOffset(orig, offset, binWidth, binDepth);
            return cutoutFitsInMask({ ...orig, ...pos }, cellMask, maskCellSize);
          })
        : clipboard;
    if (placeable.length === 0) return;

    addClonedCutouts(placeable, onAdd, setSelection, (original) =>
      clampedOffset(original, offset, binWidth, binDepth)
    );
  }, [clipboard, onAdd, setSelection, binWidth, binDepth, cellMask, maskCellSize]);

  const duplicateSelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length === 0) return;

    const placeable =
      cellMask && maskCellSize
        ? selected.filter((orig) => {
            const pos = clampedOffset(orig, PASTE_OFFSET, binWidth, binDepth);
            return cutoutFitsInMask({ ...orig, ...pos }, cellMask, maskCellSize);
          })
        : selected;
    if (placeable.length === 0) return;

    addClonedCutouts(placeable, onAdd, setSelection, (original) =>
      clampedOffset(original, PASTE_OFFSET, binWidth, binDepth)
    );
  }, [cutouts, selection, onAdd, setSelection, binWidth, binDepth, cellMask, maskCellSize]);

  return { clipboard, copySelected, pasteFromClipboard, duplicateSelected };
}
