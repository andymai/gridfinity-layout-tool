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
import type { Cutout } from '@/features/bin-designer/types';
import { specToCutout, DEFAULT_CUT_DEPTH } from '../svgImport/specToCutout';
import type { ParsedCutoutSpec } from '../svgImport/types';
import { byDescendingArea } from '../importStackOrder';
import { centerOffBoardCutouts } from '../offBoardCutouts';
import { generateLayoutId, generateUUID } from '@/shared/utils/uuid';
import { SCAN_CLEARANCE_MM } from '@/shared/scanReview/traceExport';
import { computeGrowToFit } from '../growBinToFit';
import { getCutoutBounds } from '../maskFit';
import { translateCutout } from '../cutoutHelpers';
// The scan entry point is hidden while the lid is the target, so a scan always
// lands on the bin's floor.
import { binBoard, packIntoBin } from '../packIntoBin';

export interface UseScanImportReturn {
  /**
   * Hydrate and add scan specs as cutouts in one undo transaction. Returns the
   * count added. `pack` lays every cutout out on the floor afterwards, growing
   * the bin to fit, for a phone, which has no editor to place them in.
   */
  readonly addScanCutouts: (
    specs: readonly ParsedCutoutSpec[],
    cutDepth?: number,
    options?: { readonly pack?: boolean }
  ) => number;
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

/**
 * The batch moved so its far corner is its size. A trace's frame can sit a
 * hair before the origin, which `computeGrowToFit` refuses to size; the batch
 * is centred on the board right after, so where it starts doesn't matter.
 */
function atOrigin(cutouts: readonly Cutout[]): Cutout[] {
  let minX = 0;
  let minY = 0;
  for (const cutout of cutouts) {
    const b = getCutoutBounds(cutout);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
  }
  return cutouts.map((c) => translateCutout(c, -minX, -minY));
}

export function useScanImport(): UseScanImportReturn {
  const {
    addCutout,
    setParams,
    updateCutoutsBatch,
    startTransaction,
    commitTransaction,
    queueDepthPrompt,
  } = useDesignerStore(
    useShallow((s) => ({
      addCutout: s.addCutout,
      setParams: s.setParams,
      updateCutoutsBatch: s.updateCutoutsBatch,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
      queueDepthPrompt: s.queueDepthPrompt,
    }))
  );

  const addScanCutouts = useCallback(
    (
      specs: readonly ParsedCutoutSpec[],
      cutDepth: number = DEFAULT_CUT_DEPTH,
      { pack = false }: { readonly pack?: boolean } = {}
    ): number => {
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
      // tools. A container leaves every cut as it was. Packed tools are laid
      // out one by one, so they get none.
      const containerId = !pack && hydrated.length > 1 ? generateLayoutId() : null;
      const cutouts = containerId
        ? hydrated.map((c) => ({ ...c, parentGroups: [containerId] }))
        : hydrated;
      const addedIds: string[] = [];
      startTransaction();
      try {
        if (pack) {
          for (const cutout of cutouts) {
            if (addCutout(cutout)) addedIds.push(cutout.id);
          }
          const after = useDesignerStore.getState();
          const packing = packIntoBin(after.params, after.ui.halfGridMode);
          if (packing.size) setParams(packing.size);
          updateCutoutsBatch(new Map(Object.entries(packing.placements)));
        } else {
          // Grown before placing, so the scan centers on the floor it will have.
          let board = params;
          if (ui.growBinForScan) {
            const grown = computeGrowToFit(
              params,
              [...params.cutouts, ...atOrigin(cutouts)],
              ui.halfGridMode
            );
            if (grown) {
              setParams({ width: grown.width, depth: grown.depth });
              board = useDesignerStore.getState().params;
            }
          }
          // Unlike an SVG, a scan has no layout to keep: its coordinates are the
          // outline's own frame, corner at the origin, which sits flush in the bin's
          // corner and a rounding hair past it. One scan moves to the middle as a
          // block; a scan the bin cannot hold stays put and keeps its warning.
          const moves = centerOffBoardCutouts(
            cutouts,
            binBoard(board),
            new Set(cutouts.map((c) => c.id))
          );
          for (const cutout of cutouts) {
            if (addCutout({ ...cutout, ...moves.get(cutout.id) })) addedIds.push(cutout.id);
          }
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
    [
      addCutout,
      setParams,
      updateCutoutsBatch,
      startTransaction,
      commitTransaction,
      queueDepthPrompt,
    ]
  );

  return { addScanCutouts };
}
