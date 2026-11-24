import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutPrintBed } from '@/features/bin-designer/hooks/useLayoutPrintBed';
import type { BinParams, Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import { generateLayoutId, generateUUID } from '@/shared/utils/uuid';
import { getRotatedBounds } from '../geometryCore';
import { computeGrowToFit } from '../growBinToFit';
import { setLimitOnBed, TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { generateToolSet, shiftCutout, type ToolSetNames } from '@/shared/toolSets/generateToolSet';
import { planToolSetPlacement } from './planToolSetPlacement';

export type ToolSetOutcome = 'added' | 'updated' | 'empty';

export interface ToolSetActions {
  readonly insertSet: (spec: ToolSetSpec) => ToolSetOutcome;
  /** Rebuilds an existing set in place from a new spec, as one undo step. */
  readonly rebuildSet: (setId: string, spec: ToolSetSpec) => ToolSetOutcome;
}

export function membersOf(cutouts: readonly Cutout[], setId: string): Cutout[] {
  return cutouts.filter((c) => c.parentGroups?.includes(setId) === true);
}

/** The corner a rebuilt set keeps: where the old one's cut began. */
function anchorOf(members: readonly Cutout[]): { x: number; y: number } {
  let x = Infinity;
  let y = Infinity;
  for (const c of members) {
    const b = getRotatedBounds(c);
    x = Math.min(x, b.minX - (c.clearance ?? 0));
    y = Math.min(y, b.minY - (c.clearance ?? 0));
  }
  return { x: Math.max(0, x), y: Math.max(0, y) };
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
  const { addCutout, removeCutoutsBatch, setParams, startTransaction, commitTransaction } =
    useDesignerStore(
      useShallow((s) => ({
        addCutout: s.addCutout,
        removeCutoutsBatch: s.removeCutoutsBatch,
        setParams: s.setParams,
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

  const insertSet = useCallback(
    (spec: ToolSetSpec): ToolSetOutcome => {
      const { params, ui } = useDesignerStore.getState();
      const setId = generateLayoutId();
      const set = generateToolSet(spec, TOOL_FAMILIES[spec.family], {
        setId,
        idFactory: generateUUID,
        names: names(spec),
        maxWidthMm,
      });
      if (!set) return 'empty';
      const plan = planToolSetPlacement(params, set, ui.halfGridMode);
      startTransaction();
      try {
        if (plan.size) setParams({ width: plan.size.width, depth: plan.size.depth });
        if (plan.height !== null) setParams({ height: plan.height });
        for (const cutout of set.cutouts) addCutout(shiftCutout(cutout, plan.dx, plan.dy));
        writeSpec(setId, spec, groupName(spec));
      } finally {
        commitTransaction();
      }
      return 'added';
    },
    [
      addCutout,
      setParams,
      startTransaction,
      commitTransaction,
      names,
      groupName,
      writeSpec,
      maxWidthMm,
    ]
  );

  const rebuildSet = useCallback(
    (setId: string, spec: ToolSetSpec): ToolSetOutcome => {
      const { params, ui } = useDesignerStore.getState();
      const members = membersOf(params.cutouts, setId);
      if (members.length === 0) return insertSet(spec);
      const set = generateToolSet(spec, TOOL_FAMILIES[spec.family], {
        setId,
        idFactory: generateUUID,
        names: names(spec),
        maxWidthMm,
      });
      if (!set) return 'empty';
      const { x, y } = anchorOf(members);
      const chain = outerChain(members, setId);
      const placed = set.cutouts.map((c) => ({
        ...shiftCutout(c, x, y),
        parentGroups: [...chain, setId],
      }));
      // A name the user typed survives the rebuild; the generated one follows the sizes.
      const oldName = params.cutoutGroupNames?.[setId];
      const oldSpec = params.cutoutToolSets?.[setId];
      const renamed = oldName !== undefined && (!oldSpec || oldName !== groupName(oldSpec));
      const name = renamed ? oldName : groupName(spec);
      const kept = params.cutouts.filter((c) => !members.includes(c));
      const grown = computeGrowToFit(params, [...kept, ...placed], ui.halfGridMode);
      const plan = planToolSetPlacement({ ...params, cutouts: kept }, set, ui.halfGridMode);
      startTransaction();
      try {
        removeCutoutsBatch(members.map((c) => c.id));
        if (grown) setParams({ width: grown.width, depth: grown.depth });
        if (plan.height !== null) setParams({ height: plan.height });
        for (const cutout of placed) addCutout(cutout);
        writeSpec(setId, spec, name);
      } finally {
        commitTransaction();
      }
      return 'updated';
    },
    [
      addCutout,
      removeCutoutsBatch,
      setParams,
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
