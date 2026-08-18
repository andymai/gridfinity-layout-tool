/**
 * The board's swappable-label socket plan, keyed for per-cutout lookup.
 *
 * Reads the same `planCutoutSocketsForParams` the worker cuts from, so a
 * width the picker offers always has a pocket behind it and a warning the
 * panel shows is a socket the build really dropped.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import {
  MAX_CUTOUT_LABEL_SOCKETS,
  planCutoutSocketsForParams,
} from '@/shared/utils/cutoutLabelSocketPlan';
import type {
  CutoutSocketPlacement,
  CutoutSocketSkipReason,
} from '@/shared/utils/cutoutLabelSocketPlan';

export { MAX_CUTOUT_LABEL_SOCKETS };

export interface CutoutSocketPlanView {
  readonly byCutoutId: ReadonlyMap<string, CutoutSocketPlacement>;
  /**
   * Interior dimensions the plan was measured against. Socket centers are in
   * the BIN-CENTRED frame the worker cuts in; a consumer drawing in the 2D
   * editor's interior-corner frame adds half of these rather than reaching for
   * a prop that may describe a different box.
   */
  readonly innerW: number;
  readonly innerD: number;
  readonly skippedByCutoutId: ReadonlyMap<string, CutoutSocketSkipReason>;
  /** Sockets the build will cut. */
  readonly socketCount: number;
  /** Socket-mode cutouts that end up without one. */
  readonly skippedCount: number;
}

const EMPTY: CutoutSocketPlanView = {
  byCutoutId: new Map(),
  innerW: 0,
  innerD: 0,
  skippedByCutoutId: new Map(),
  socketCount: 0,
  skippedCount: 0,
};

export function useCutoutSocketPlan(): CutoutSocketPlanView {
  const { params, cutouts } = useDesignerStore(
    useShallow((s) => ({ params: s.params, cutouts: s.params.cutouts }))
  );

  return useMemo(() => {
    if (cutouts.length === 0) return EMPTY;
    // The cutout frame is the overhang-EXPANDED interior (`cutoutInterior`),
    // exactly as the generator places sockets against `dim.innerW`. The
    // nominal `binDimensions` interior under-reports the room on an
    // overhung board, so the panel and the worker would size different
    // plates for the same pocket.
    const { innerW, innerD } = cutoutInterior(params);
    const { wallHeight } = binDimensions(params);
    const plan = planCutoutSocketsForParams(params, innerW, innerD, wallHeight);
    if (plan.sockets.length === 0 && plan.skipped.length === 0) return EMPTY;
    return {
      byCutoutId: new Map(plan.sockets.map((s) => [s.cutoutId, s])),
      innerW,
      innerD,
      skippedByCutoutId: new Map(plan.skipped.map((s) => [s.cutoutId, s.reason])),
      socketCount: plan.sockets.length,
      skippedCount: plan.skipped.length,
    };
  }, [params, cutouts]);
}
