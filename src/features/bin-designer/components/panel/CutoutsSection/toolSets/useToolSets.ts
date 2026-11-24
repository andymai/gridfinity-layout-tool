import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { err, ok, type Result } from '@/core/result';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutPrintBed } from '@/features/bin-designer/hooks/useLayoutPrintBed';
import type { BinParams, Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import { generateLayoutId, generateUUID } from '@/shared/utils/uuid';
import { setLimitOnBed, TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { generateToolSet, shiftCutout, type ToolSetNames } from '@/shared/toolSets/generateToolSet';
import {
  membersOf,
  planToolSetPlacement,
  planToolSetRebuild,
  type ToolSetPlacement,
} from './planToolSetPlacement';

/**
 * Why a set could not be placed; nothing changed in either case.
 * - `empty`: no size in the spec is in the family's table.
 * - `noRoom`: no bin size the bin can take holds the set.
 */
export type ToolSetFailure = 'empty' | 'noRoom';

export { membersOf };

export interface ToolSetActions {
  readonly insertSet: (spec: ToolSetSpec) => Result<'added', ToolSetFailure>;
  /** Rebuilds an existing set in place from a new spec, as one undo step. */
  readonly rebuildSet: (
    setId: string,
    spec: ToolSetSpec
  ) => Result<'added' | 'updated', ToolSetFailure>;
}

/** The containers a rebuilt set sat inside, kept so it stays where the user put it. */
function outerChain(members: readonly Cutout[], setId: string): string[] {
  const chain = members[0]?.parentGroups ?? [];
  const at = chain.indexOf(setId);
  return at > 0 ? chain.slice(0, at) : [];
}

export function useToolSets(): ToolSetActions {
  const t = useTranslation();
  const { printBedSize } = useLayoutPrintBed();
  const maxWidthMm = setLimitOnBed(printBedSize);
  const {
    addCutout,
    removeCutoutsBatch,
    setParams,
    updateCutoutConfig,
    startTransaction,
    commitTransaction,
  } = useDesignerStore(
    useShallow((s) => ({
      addCutout: s.addCutout,
      removeCutoutsBatch: s.removeCutoutsBatch,
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

  const groupName = useCallback(
    (spec: ToolSetSpec): string => {
      const sizes = TOOL_FAMILIES[spec.family].table[spec.units]
        .filter((e) => spec.sizes.includes(e.key))
        .sort((a, b) => a.jawMm - b.jawMm);
      const from = sizes.at(0)?.key ?? '';
      const to = sizes.at(-1)?.key ?? '';
      return spec.units === 'metric'
        ? t('binDesigner.toolSets.groupNameMetric', { from, to })
        : t('binDesigner.toolSets.groupNameSae', { from, to });
    },
    [t]
  );

  const writeSpec = useCallback(
    (setId: string, spec: ToolSetSpec, name: string) => {
      const after: BinParams = useDesignerStore.getState().params;
      setParams({
        cutoutToolSets: { ...(after.cutoutToolSets ?? {}), [setId]: spec },
        cutoutGroupNames: { ...(after.cutoutGroupNames ?? {}), [setId]: name },
      });
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
        idFactory: generateUUID,
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
        writeSpec(setId, spec, groupName(spec));
      } finally {
        commitTransaction();
      }
      return ok('added');
    },
    [
      addCutout,
      resizeFor,
      startTransaction,
      commitTransaction,
      names,
      groupName,
      writeSpec,
      maxWidthMm,
    ]
  );

  const rebuildSet = useCallback(
    (setId: string, spec: ToolSetSpec): Result<'added' | 'updated', ToolSetFailure> => {
      const { params, ui } = useDesignerStore.getState();
      const members = membersOf(params.cutouts, setId);
      if (members.length === 0) return insertSet(spec);
      const set = generateToolSet(spec, TOOL_FAMILIES[spec.family], {
        setId,
        idFactory: generateUUID,
        names: names(spec),
        maxWidthMm,
      });
      if (!set) return err('empty');
      const chain = outerChain(members, setId);
      // A name the user typed survives the rebuild; the generated one follows the sizes.
      const oldName = params.cutoutGroupNames?.[setId];
      const oldSpec = params.cutoutToolSets?.[setId];
      const renamed = oldName !== undefined && (!oldSpec || oldName !== groupName(oldSpec));
      const name = renamed ? oldName : groupName(spec);

      const placement = planToolSetRebuild(params, setId, set, ui.halfGridMode);
      if (!placement) return err('noRoom');

      startTransaction();
      try {
        resizeFor(placement);
        // Added before the old members go, so the metadata sweep on removal
        // still sees the enclosing containers and keeps their names.
        for (const cutout of set.cutouts) {
          addCutout({
            ...shiftCutout(cutout, placement.dx, placement.dy),
            parentGroups: [...chain, setId],
          });
        }
        removeCutoutsBatch(members.map((c) => c.id));
        writeSpec(setId, spec, name);
      } finally {
        commitTransaction();
      }
      return ok('updated');
    },
    [
      addCutout,
      removeCutoutsBatch,
      resizeFor,
      startTransaction,
      commitTransaction,
      names,
      groupName,
      writeSpec,
      insertSet,
      maxWidthMm,
    ]
  );

  return useMemo(() => ({ insertSet, rebuildSet }), [insertSet, rebuildSet]);
}
