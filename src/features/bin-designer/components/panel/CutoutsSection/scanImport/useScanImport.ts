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
          // Give scanned outlines a slight self-centering entry chamfer by default
          // (the in-plane fit clearance is already baked into the traced geometry).
          const chamferWidth =
            cutout.shape === 'path'
              ? defaultEntryChamfer(Math.min(cutout.width, cutout.depth), cutDepth)
              : cutout.chamferWidth;
          addCutout({ ...cutout, chamferWidth });
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
