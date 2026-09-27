import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import { clamp } from '@/shared/utils/math';
import { interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import { interiorFilletFitMm } from '@/features/bin-designer/utils/interiorFilletFit';
import { getFeatureStatus, resolveConstraints } from '@/shared/constraints';

const { MIN_INTERIOR_FILLET, MAX_INTERIOR_FILLET } = DESIGNER_CONSTRAINTS;

export function useInteriorFilletSection() {
  const { params, setParams, setParam } = useDesignerStore(
    useShallow((s) => ({ params: s.params, setParams: s.setParams, setParam: s.setParam }))
  );
  const t = useTranslation();

  const status = getFeatureStatus(params, 'interiorFillet');
  const radius = interiorFilletRadiusMm(params);
  const enabled = radius > 0;
  const clamped = useMemo(
    () => enabled && radius >= interiorFilletFitMm(params),
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
