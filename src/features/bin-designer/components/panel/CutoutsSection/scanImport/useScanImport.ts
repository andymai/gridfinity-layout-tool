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
import { specToCutout, DEFAULT_CUT_DEPTH } from '../svgImport/specToCutout';
import type { ParsedCutoutSpec } from '../svgImport/types';
import { byDescendingArea } from '../importStackOrder';
import { generateUUID } from '@/shared/utils/uuid';

/** Default insertion clearance (mm) applied to a scanned tool outline. */
const SCAN_DEFAULT_CLEARANCE_MM = 0.4;

export interface UseScanImportReturn {
  /** Hydrate and add scan specs as cutouts in one undo transaction. Returns the count added. */
  readonly addScanCutouts: (specs: readonly ParsedCutoutSpec[], cutDepth?: number) => number;
}

export function useScanImport(): UseScanImportReturn {
  const { addCutout, startTransaction, commitTransaction } = useDesignerStore(
    useShallow((s) => ({
      addCutout: s.addCutout,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
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

      let added = 0;
      startTransaction();
      try {
        // Same stacking rule as the SVG path: a scan can trace an
        // outer silhouette around smaller detail.
        for (const spec of byDescendingArea(specs)) {
          const cutout = specToCutout(spec, hydrationOptions);
          // Scanned outlines default to a fit clearance + self-centering entry
          // chamfer (both applied at generation time, like parametric cutouts, and
          // adjustable via the Fit controls). The traced outline itself stays the
          // tool's exact silhouette.
          const stored =
            cutout.shape === 'path'
              ? addCutout({
                  ...cutout,
                  clearance: SCAN_DEFAULT_CLEARANCE_MM,
                  chamferWidth: defaultEntryChamfer(Math.min(cutout.width, cutout.depth), cutDepth),
                })
              : addCutout(cutout);
          if (stored) added += 1;
        }
      } finally {
        commitTransaction();
      }

      // The count STORED, not the count asked for. The scan entry point is
      // hidden while the lid is the target, so nothing refuses today, but a
      // caller that toasts this number must not be the thing that has to
      // remember why it happened to be right.
      return added;
    },
    [addCutout, startTransaction, commitTransaction]
  );

  return { addScanCutouts };
}
