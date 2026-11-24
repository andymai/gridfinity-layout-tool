import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { err, ok, type Result } from '@/core/result';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutPrintBed } from '@/features/bin-designer/hooks/useLayoutPrintBed';
import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import type { ToolSetPart } from '@/shared/types/toolSet';
import { generateLayoutId, generateUUID } from '@/shared/utils/uuid';
import { setLimitOnBed, TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { generateToolSet, shiftCutout, type ToolSetNames } from '@/shared/toolSets/generateToolSet';
import {
  planToolSetPlacement,
  planToolSetRebuild,
  type ToolSetPlacement,
} from './planToolSetPlacement';
import { partsOf } from '@/features/bin-designer/utils/toolSetMembership';

/**
 * Why a set could not be placed; nothing changed in any case.
 * - `empty`: no size in the spec is in the family's table.
 * - `noRoom`: no bin size the bin can take holds the set.
 * - `locked`: a pocket of the set is locked, and a rebuild would replace it.
 */
export type ToolSetFailure = 'empty' | 'noRoom' | 'locked';

export interface ToolSetActions {
  readonly insertSet: (spec: ToolSetSpec) => Result<'added', ToolSetFailure>;
  /**
   * Rebuilds a set from a new spec as one undo step, under the same id: in
   * place when it still fits there, else beside the other pockets.
   */
  readonly rebuildSet: (setId: string, spec: ToolSetSpec) => Result<'updated', ToolSetFailure>;
}

/** The containers a rebuilt set sits inside, kept so it stays where the user put it. */
function outerChain(cutouts: readonly Cutout[], setId: string): string[] {
  const chain = cutouts.find((c) => c.parentGroups?.includes(setId) === true)?.parentGroups ?? [];
  return chain.slice(0, Math.max(0, chain.indexOf(setId)));
}

export function useToolSets(): ToolSetActions {
  const t = useTranslation();
  const { printBedSize } = useLayoutPrintBed();
  const maxWidthMm = setLimitOnBed(printBedSize);
  const {
    addCutout,
    replaceCutouts,
    setParams,
    updateCutoutConfig,
    startTransaction,
    commitTransaction,
  } = useDesignerStore(
    useShallow((s) => ({
      addCutout: s.addCutout,
      replaceCutouts: s.replaceCutouts,
      setParams: s.setParams,
      updateCutoutConfig: s.updateCutoutConfig,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
    }))
  );

  const names = useCallback(
    (spec: ToolSetSpec): ToolSetNames => ({
      pocket: (size) =>
        spec.units === 'metric'
          ? t('binDesigner.toolSets.pocketNameMetric', { size })
          : t('binDesigner.toolSets.pocketNameSae', { size }),
      channel: t('binDesigner.toolSets.fingerChannel'),
    }),
    [t]
  );

  const writeSpec = useCallback(
    (setId: string, spec: ToolSetSpec) => {
      const sets = useDesignerStore.getState().params.cutoutToolSets;
      setParams({ cutoutToolSets: { ...(sets ?? {}), [setId]: spec } });
    },
    [setParams]
  );

  /**
   * Grows and raises the bin for a placement. A floor-anchored fill keeps its
   * height across a height change, so its top recess is put back by hand, or
   * the pockets would stay as shallow as before.
   */
  const resizeFor = useCallback(
    (placement: ToolSetPlacement) => {
      const before = useDesignerStore.getState().params.cutoutConfig;
      if (placement.size) setParams({ width: placement.size.width, depth: placement.size.depth });
      if (placement.height === null) return;
      setParams({ height: placement.height });
      if (before.fillReference === 'floor') updateCutoutConfig({ topOffset: before.topOffset });
    },
    [setParams, updateCutoutConfig]
  );

  const insertSet = useCallback(
    (spec: ToolSetSpec): Result<'added', ToolSetFailure> => {
      const { params, ui } = useDesignerStore.getState();
      const setId = generateLayoutId();
      const set = generateToolSet(spec, TOOL_FAMILIES[spec.family], {
        setId,
        idFor: generateUUID,
        names: names(spec),
        maxWidthMm,
      });
      if (!set) return err('empty');
      const plan = planToolSetPlacement(params, set, ui.halfGridMode);
      if (!plan) return err('noRoom');
      startTransaction();
      try {
        resizeFor(plan);
        for (const cutout of set.cutouts) addCutout(shiftCutout(cutout, plan.dx, plan.dy));
        writeSpec(setId, spec);
      } finally {
        commitTransaction();
      }
      return ok('added');
    },
    [addCutout, resizeFor, startTransaction, commitTransaction, names, writeSpec, maxWidthMm]
  );

  const rebuildSet = useCallback(
    (setId: string, spec: ToolSetSpec): Result<'updated', ToolSetFailure> => {
      const { params, ui } = useDesignerStore.getState();
      const parts = partsOf(params.cutouts, setId, params.cutoutToolSets);
      if (parts.some((c) => c.locked === true)) return err('locked');
      const oldIds = new Map(
        parts.flatMap((c) => (c.toolSetPart ? [[c.toolSetPart, c.id] as const] : []))
      );
      const set = generateToolSet(spec, TOOL_FAMILIES[spec.family], {
        setId,
        idFor: (part: ToolSetPart) => oldIds.get(part) ?? generateUUID(),
        names: names(spec),
        maxWidthMm,
      });
      if (!set) return err('empty');
      const placement = planToolSetRebuild(params, setId, set, ui.halfGridMode);
      if (!placement) return err('noRoom');

      const chain = [...outerChain(parts.length > 0 ? parts : params.cutouts, setId), setId];
      startTransaction();
      try {
        resizeFor(placement);
        replaceCutouts(
          parts.map((c) => c.id),
          set.cutouts.map((c) => ({
            ...shiftCutout(c, placement.dx, placement.dy),
            parentGroups: chain,
          }))
        );
        writeSpec(setId, spec);
      } finally {
        commitTransaction();
      }
      return ok('updated');
    },
    [replaceCutouts, resizeFor, startTransaction, commitTransaction, names, writeSpec, maxWidthMm]
  );

  return useMemo(() => ({ insertSet, rebuildSet }), [insertSet, rebuildSet]);
}
