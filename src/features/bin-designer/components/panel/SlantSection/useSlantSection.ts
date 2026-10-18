import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { SLANT_MAX_DEG, SLANT_WARN_DEG } from '@/core/types';
import type { SlantConfig, SlantSide } from '@/core/types';
import {
  resolveSlant,
  slantBlocker,
  slantTopOffsetMm,
  type SlantBlocker,
} from '@/shared/utils/slantPlan';
import { resolveBinFloorMm } from '@/shared/utils/slotMath';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartmentGrid';
import { builtCompartmentFloorRaiseMm } from '@/features/bin-designer/utils/compartmentFloorRaise';
import type { BinParams } from '@/features/bin-designer/types';

export const SLANT_DEFAULT_DEG = 45;
export const SLANT_MIN_DEG = 1;

/** Each blocker names itself by the label its own control already carries. */
const BLOCKER_LABEL: Record<Exclude<SlantBlocker, 'openFloor'>, string> = {
  overhang: 'binDesigner.overhang.title',
  customShape: 'binDesigner.shape.customShape',
  meshPocket: 'binDesigner.cutouts.shapeName.mesh',
  trayBottom: 'binDesigner.lidBottom',
  slide: 'binDesigner.slideTray.title',
  knifeRest: 'binDesigner.knifeRest.title',
  floorPattern: 'binDesigner.base.floorPattern',
  detachableFeet: 'binDesigner.detachableFeet',
  removableDividers: 'binDesigner.slottedInteriorSummary',
  pullTab: 'binDesigner.pullTab.title',
};

/** Shown with the labs flag on, and always for a design that already leans, so it can be undone. */
export function useSlantVisible(): boolean {
  const labsOn = useFeatureFlag('slant');
  const hasSlant = useDesignerStore((s) => s.params.slant !== undefined);
  return labsOn || hasSlant;
}

/**
 * The diagonal only holds while nothing stands across the lean: a standard bin
 * whose every compartment runs the full length of the lean axis.
 */
function leanIsUnobstructed(params: BinParams, axis: 'x' | 'y'): boolean {
  if (params.style !== 'standard') return false;
  const config = params.compartments;
  for (const id of new Set(config.cells)) {
    const bounds = getCompartmentBounds(config, id);
    if (!bounds) continue;
    const spansLean =
      axis === 'x'
        ? bounds.minCol === 0 && bounds.maxCol === config.cols - 1
        : bounds.minRow === 0 && bounds.maxRow === config.rows - 1;
    if (!spansLean) return false;
  }
  return true;
}

export function useSlantSection() {
  const { params, setParams } = useDesignerStore(
    useShallow((s) => ({ params: s.params, setParams: s.setParams }))
  );
  const t = useTranslation();
  const slant = params.slant;
  const blocker = slantBlocker(params);
  const plan = resolveSlant(params);

  // Turning the slant on takes the stacking lip with it, in the stored params,
  // because every reader of `base.stackingLip` takes it at face value.
  const write = useCallback(
    (next: SlantConfig | undefined) => {
      setParams(
        next ? { slant: next, base: { ...params.base, stackingLip: false } } : { slant: undefined }
      );
    },
    [params.base, setParams]
  );

  const toggle = useCallback(() => {
    write(slant ? undefined : { angleDeg: SLANT_DEFAULT_DEG, side: 'back' });
  }, [slant, write]);

  const setAngle = useCallback(
    (deg: number) => {
      if (!slant || !Number.isFinite(deg)) return;
      const angleDeg = Math.min(SLANT_MAX_DEG, Math.max(SLANT_MIN_DEG, Math.round(deg)));
      write({ ...slant, angleDeg });
    },
    [slant, write]
  );

  const setSide = useCallback(
    (side: SlantSide) => {
      if (slant) write({ ...slant, side });
    },
    [slant, write]
  );

  const toggleEndSupport = useCallback(() => {
    if (!slant) return;
    const { endSupport, ...rest } = slant;
    write(endSupport ? rest : { ...rest, endSupport: true });
  }, [slant, write]);

  const blockerName = useMemo(() => {
    if (!blocker) return null;
    if (blocker === 'openFloor') {
      return t(params.base.spacer ? 'binDesigner.spacer' : 'binDesigner.lightweight');
    }
    return t(BLOCKER_LABEL[blocker]);
  }, [blocker, params.base.spacer, t]);

  const readouts = useMemo(() => {
    if (!plan) return null;
    const dims = binDimensions(params);
    const topOffsetMm = slantTopOffsetMm(params);
    if (!leanIsUnobstructed(params, plan.axis)) return { topOffsetMm, longestItemMm: null };
    // Every compartment spans the lean, so the longest item stands in the one
    // with the lowest floor.
    const raises = [...new Set(params.compartments.cells)].map((id) =>
      builtCompartmentFloorRaiseMm(params, id)
    );
    const lowestRaise = raises.length > 0 ? Math.min(...raises) : 0;
    // `floorZ` is the floor's underside; an item stands on its top.
    const cavityH =
      dims.totalH +
      Math.max(0, params.extraWallHeightMm ?? 0) -
      dims.floorZ -
      resolveBinFloorMm(params) -
      lowestRaise;
    const inner = plan.axis === 'x' ? dims.innerW : dims.innerD;
    // The cavity is a parallelogram along the lean; its longer diagonal runs
    // from the low floor corner to the top corner the lean carried out.
    const longestItemMm = Math.hypot(inner + plan.k * cavityH, cavityH);
    return { topOffsetMm, longestItemMm };
  }, [plan, params]);

  return {
    state: {
      enabled: slant !== undefined,
      angleDeg: slant?.angleDeg ?? SLANT_DEFAULT_DEG,
      side: slant?.side ?? 'back',
      endSupport: slant?.endSupport === true,
      applied: plan !== null,
      steep: plan !== null && plan.angleDeg > SLANT_WARN_DEG,
      readouts,
    },
    meta: { blockerName },
    handlers: { toggle, setAngle, setSide, toggleEndSupport },
    t,
  };
}
