/**
 * Store hook that commits scanned outline specs as cutouts.
 *
 * Mirrors the SVG-import store wiring: each spec is hydrated and added inside a
 * single undo transaction. Kept separate from parsing/scaling (scanIngest) so
 * the geometry is testable without the store.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore, remainingCutoutCapacity } from '@/features/bin-designer/store';
import { defaultEntryChamfer } from '@/features/bin-designer/types';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { specToCutout, DEFAULT_CUT_DEPTH } from '../svgImport/specToCutout';
import type { ParsedCutoutSpec } from '../svgImport/types';
import { byDescendingArea } from '../importStackOrder';
import { centerOffBoardCutouts, type CutoutBoard } from '../offBoardCutouts';
import { generateLayoutId, generateUUID } from '@/shared/utils/uuid';
import { SCAN_CLEARANCE_MM } from '@/shared/scanReview/traceExport';

export interface UseScanImportReturn {
  /** Hydrate and add scan specs as cutouts in one undo transaction. Returns the count added. */
  readonly addScanCutouts: (specs: readonly ParsedCutoutSpec[], cutDepth?: number) => number;
}

// The bin's floor, as CutoutWorkspace builds it. The scan entry point is hidden
// while the lid is the target, so a scan always lands on the bin.
function binBoard(params: BinParams): CutoutBoard {
  const { innerW, innerD } = cutoutInterior(params);
  const mask = params.cellMask;
  return {
    width: innerW,
    depth: innerD,
    mask,
    cellSize: mask ? { cellMmX: innerW / mask.cols, cellMmY: innerD / mask.rows } : undefined,
  };
}

function withScanFit(cutout: Cutout, cutDepth: number): Cutout {
  // Scanned outlines default to a fit clearance + self-centering entry
  // chamfer (both applied at generation time, like parametric cutouts, and
  // adjustable via the Fit controls). The traced outline itself stays the
  // tool's exact silhouette.
  if (cutout.shape !== 'path') return cutout;
  return {
    ...cutout,
    clearance: SCAN_CLEARANCE_MM,
    chamferWidth: defaultEntryChamfer(Math.min(cutout.width, cutout.depth), cutDepth),
  };
}

export function useScanImport(): UseScanImportReturn {
  const { addCutout, startTransaction, commitTransaction, queueDepthPrompt } = useDesignerStore(
    useShallow((s) => ({
      addCutout: s.addCutout,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
      queueDepthPrompt: s.queueDepthPrompt,
    }))
  );

  const addScanCutouts = useCallback(
    (specs: readonly ParsedCutoutSpec[], cutDepth: number = DEFAULT_CUT_DEPTH): number => {
      const hydrationOptions = { cutDepth, idFactory: generateUUID };

      // Checked before the history push, the same rule the store's own batch
      // paths state: a batch that cannot land a single shape must not spend an
      // undo slot or bump the generation epoch for unchanged geometry.
      const { ui, params } = useDesignerStore.getState();
      if (remainingCutoutCapacity(ui.cutoutTarget, params.lid.cutouts) < 1) return 0;

      // Same stacking rule as the SVG path: a scan can trace an
      // outer silhouette around smaller detail.
      const hydrated = byDescendingArea(specs).map((spec) =>
        withScanFit(specToCutout(spec, hydrationOptions), cutDepth)
      );
      // Several tools from one photo arrive in one arrange-only container,
      // so the batch moves as a block and Auto-arrange inside it packs the
      // tools. A container leaves every cut as it was.
      const containerId = hydrated.length > 1 ? generateLayoutId() : null;
      const cutouts = containerId
        ? hydrated.map((c) => ({ ...c, parentGroups: [containerId] }))
        : hydrated;
      // Unlike an SVG, a scan has no layout to keep: its coordinates are the
      // outline's own frame, corner at the origin, which sits flush in the bin's
      // corner and a rounding hair past it. One scan moves to the middle as a
      // block; a scan the bin cannot hold stays put and keeps its warning.
      const moves = centerOffBoardCutouts(
        cutouts,
        binBoard(params),
        new Set(cutouts.map((c) => c.id))
      );

      const addedIds: string[] = [];
      startTransaction();
      try {
        for (const cutout of cutouts) {
          if (addCutout({ ...cutout, ...moves.get(cutout.id) })) addedIds.push(cutout.id);
        }
      } finally {
        commitTransaction();
      }
      // A traced outline says nothing about how thick the tool is. A lid plate
      // is cut clean through, so only a bin has a depth to ask for.
      if (ui.cutoutTarget === 'bin') queueDepthPrompt(addedIds);
      const added = addedIds.length;

      // The count STORED, not the count asked for. The scan entry point is
      // hidden while the lid is the target, so nothing refuses today, but a
      // caller that toasts this number must not be the thing that has to
      // remember why it happened to be right.
      return added;
    },
    [addCutout, startTransaction, commitTransaction, queueDepthPrompt]
  );

  return { addScanCutouts };
}
