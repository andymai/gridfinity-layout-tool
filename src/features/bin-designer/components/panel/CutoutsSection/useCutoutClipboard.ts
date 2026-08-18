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
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { MaskCellSize } from './maskFit';
import { useShallow } from 'zustand/react/shallow';
import { MAX_LID_CUTOUTS } from '@/features/bin-designer/types';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { cutoutFitsInMask } from './maskFit';
import { addClonedCutouts, clampedOffset, clampedDelta } from './cutoutHelpers';
import { PASTE_OFFSET } from './cutoutInteractionTypes';
import { trackEvent } from '@/shared/analytics/posthog';

/** Movement below this (mm) is noise, not a deliberate placement. */
const STEP_CHAIN_EPSILON = 0.01;

/** Consecutive duplicates of one shape before the repeat hint is offered. */
const REPEAT_HINT_AFTER = 3;

/** Settings id for the once-per-browser repeat hint. */
const REPEAT_HINT_ID = 'cutout-repeat-duplicating';

/** The live step-and-repeat chain: what was duplicated, and from where. */
interface StepChain {
  readonly anchorId: string;
  readonly anchorOrigin: { readonly x: number; readonly y: number };
  readonly cloneIds: readonly string[];
  /** Consecutive duplicates in this run, however each was placed. */
  readonly runLength: number;
  /** Consecutive duplicates that reused a deliberate offset. */
  readonly stepLength: number;
}

/** True when the selection is exactly the set of clones the chain produced. */
function sameIds(chainIds: readonly string[], selected: readonly Cutout[]): boolean {
  if (chainIds.length !== selected.length) return false;
  const ids = new Set(chainIds);
  return selected.every((c) => ids.has(c.id));
}

interface UseCutoutClipboardOptions {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly setSelection: (sel: ReadonlySet<string>) => void;
  readonly onAdd: (cutout: Cutout) => boolean;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly cellMask?: CellMask;
  readonly maskCellSize?: MaskCellSize;
  readonly meshAssets?: Readonly<Record<string, MeshAsset>>;
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
  meshAssets,
}: UseCutoutClipboardOptions): CutoutClipboard {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const reportClipped = useCallback(
    (landed: number, requested: number) => {
      addToast({
        message: t('toast.cutoutsClipped', { added: landed, requested, max: MAX_LID_CUTOUTS }),
        type: 'error',
      });
    },
    [addToast, t]
  );
  const [clipboard, setClipboard] = useState<readonly Cutout[]>([]);
  const pasteCountRef = useRef(0);
  const stepChainRef = useRef<StepChain | undefined>(undefined);
  const { dismissedHints, updateSettings } = useSettingsStore(
    useShallow((s) => ({
      dismissedHints: s.settings.dismissedHints,
      updateSettings: s.updateSettings,
    }))
  );

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
            return cutoutFitsInMask({ ...orig, ...pos }, cellMask, maskCellSize, meshAssets);
          })
        : clipboard;
    if (placeable.length === 0) return;

    addClonedCutouts(
      placeable,
      onAdd,
      setSelection,
      (original) => clampedOffset(original, offset, binWidth, binDepth),
      reportClipped
    );
  }, [
    clipboard,
    onAdd,
    setSelection,
    binWidth,
    binDepth,
    cellMask,
    maskCellSize,
    meshAssets,
    reportClipped,
  ]);

  const duplicateSelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length === 0) return;

    // Step-and-repeat: once a duplicate has been moved somewhere deliberate,
    // repeat that placement instead of the 2mm nudge. The delta is measured
    // from where the source sat when it was cloned to where the clone is now,
    // so moving the newest copy again re-aims the chain rather than locking in
    // a stale offset.
    const chain = stepChainRef.current;
    const chained = chain !== undefined && sameIds(chain.cloneIds, selected);
    let { dx, dy } = { dx: PASTE_OFFSET, dy: PASTE_OFFSET };
    let stepLength = 1;
    if (chained) {
      const anchor = cutouts.find((c) => c.id === chain.anchorId);
      if (anchor) {
        const movedX = anchor.x - chain.anchorOrigin.x;
        const movedY = anchor.y - chain.anchorOrigin.y;
        if (Math.hypot(movedX, movedY) > STEP_CHAIN_EPSILON) {
          dx = movedX;
          dy = movedY;
          stepLength = chain.stepLength + 1;
        }
      }
    }
    const runLength = chained ? chain.runLength + 1 : 1;

    const placeable =
      cellMask && maskCellSize
        ? selected.filter((orig) => {
            const pos = clampedDelta(orig, dx, dy, binWidth, binDepth);
            return cutoutFitsInMask({ ...orig, ...pos }, cellMask, maskCellSize, meshAssets);
          })
        : selected;
    if (placeable.length === 0) return;

    const clones = addClonedCutouts(
      placeable,
      onAdd,
      setSelection,
      (original) => clampedDelta(original, dx, dy, binWidth, binDepth),
      reportClipped
    );

    const anchorClone = clones.at(0);
    const anchorSource = anchorClone
      ? placeable.find((c) => c.id === anchorClone.originalId)
      : undefined;
    stepChainRef.current = anchorClone &&
      anchorSource && {
        anchorId: anchorClone.id,
        anchorOrigin: { x: anchorSource.x, y: anchorSource.y },
        cloneIds: clones.map((c) => c.id),
        runLength,
        stepLength,
      };

    if (stepLength > 1) trackEvent('cutout_step_repeat_used', { chain_length: stepLength });

    // Someone duplicating the same shape three times over is doing by hand
    // what Repeat does parametrically. Purely informational, and once per
    // browser: plain Ctrl+D leaves a 2mm diagonal staircase, which is not a
    // pattern the detector can offer to convert, so an action here would
    // either mislead or have to move the design without being asked.
    if (runLength >= REPEAT_HINT_AFTER && !dismissedHints.includes(REPEAT_HINT_ID)) {
      updateSettings({ dismissedHints: [...dismissedHints, REPEAT_HINT_ID] });
      trackEvent('cutout_repeat_hint_shown', { run_length: runLength });
      addToast({ message: t('binDesigner.cutouts.repeat.hint'), type: 'info', duration: 8000 });
    }
  }, [
    cutouts,
    selection,
    onAdd,
    setSelection,
    binWidth,
    binDepth,
    cellMask,
    maskCellSize,
    meshAssets,
    dismissedHints,
    updateSettings,
    addToast,
    t,
    reportClipped,
  ]);

  return { clipboard, copySelected, pasteFromClipboard, duplicateSelected };
}
