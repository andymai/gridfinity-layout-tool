import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import { clamp } from '@/shared/utils/math';
import { interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import { getFeatureStatus, resolveConstraints } from '@/shared/constraints';
import type { BinParams } from '@/shared/types/bin';

const { MIN_INTERIOR_FILLET, MAX_INTERIOR_FILLET } = DESIGNER_CONSTRAINTS;

/**
 * Half the narrowest compartment's shorter side: past it, that compartment
 * rounds as far as it fits rather than to the radius asked for.
 */
function narrowestHalfSpan(params: BinParams): number {
  const { innerW, innerD } = binDimensions(params);
  const { cols, rows, cells, thickness } = params.compartments;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  let narrowest = Infinity;
  for (const id of new Set(cells)) {
    const b = getCompartmentBounds(params.compartments, id);
    if (!b) continue;
    const dividers = (n: number, lo: number, hi: number): number =>
      ((lo > 0 ? 1 : 0) + (hi < n - 1 ? 1 : 0)) * (thickness / 2);
    const w = (b.maxCol - b.minCol + 1) * cellW - dividers(cols, b.minCol, b.maxCol);
    const d = (b.maxRow - b.minRow + 1) * cellD - dividers(rows, b.minRow, b.maxRow);
    narrowest = Math.min(narrowest, w, d);
  }
  return narrowest / 2;
}

export function useInteriorFilletSection() {
  const { params, setParams, setParam } = useDesignerStore(
    useShallow((s) => ({ params: s.params, setParams: s.setParams, setParam: s.setParam }))
  );
  const t = useTranslation();

  const status = getFeatureStatus(params, 'interiorFillet');
  const radius = interiorFilletRadiusMm(params);
  const enabled = radius > 0;
  const clamped = useMemo(
    () => enabled && radius >= narrowestHalfSpan(params),
    [enabled, radius, params]
  );

  const toggle = useCallback(() => {
    if (!enabled && !status.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'interiorFillet',
      enabled: !enabled,
    });
    setParams(resolved);
  }, [enabled, status.available, params, setParams]);

  const setRadius = useCallback(
    (next: number) => {
      setParam('interiorFilletMm', clamp(next, MIN_INTERIOR_FILLET, MAX_INTERIOR_FILLET));
    },
    [setParam]
  );

  return {
    state: { enabled, radius, clamped },
    handlers: { toggle, setRadius },
    meta: {
      disabledReason: status.reason ? t(status.reason) : undefined,
      summary: enabled && status.available ? `${radius}mm` : undefined,
    },
    t,
  };
}
