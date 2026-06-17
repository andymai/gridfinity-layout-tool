/**
 * Store hook that commits scanned outline specs as cutouts.
 *
 * Mirrors the SVG-import store wiring: each spec is hydrated and added inside a
 * single undo transaction. Kept separate from parsing/scaling (scanIngest) so
 * the geometry is testable without the store.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { defaultEntryChamfer } from '@/features/bin-designer/types';
import { specToCutout, DEFAULT_CUT_DEPTH } from '../svgImport/specToCutout';
import type { ParsedCutoutSpec } from '../svgImport/types';

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
      const hydrationOptions = { cutDepth, idFactory: () => crypto.randomUUID() };

      startTransaction();
      try {
        for (const spec of specs) {
          const cutout = specToCutout(spec, hydrationOptions);
          // Scanned outlines default to a fit clearance + self-centering entry
          // chamfer (both applied at generation time, like parametric cutouts, and
          // adjustable via the Fit controls). The traced outline itself stays the
          // tool's exact silhouette.
          if (cutout.shape === 'path') {
            addCutout({
              ...cutout,
              clearance: SCAN_DEFAULT_CLEARANCE_MM,
              chamferWidth: defaultEntryChamfer(Math.min(cutout.width, cutout.depth), cutDepth),
            });
          } else {
            addCutout(cutout);
          }
        }
      } finally {
        commitTransaction();
      }

      return specs.length;
    },
    [addCutout, startTransaction, commitTransaction]
  );

  return { addScanCutouts };
}
