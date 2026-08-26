import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';

/** Read-only summary for the Finishing group when collapsed. */
export function useFinishingGroupSummary(): string {
  const t = useTranslation();
  const { colorsEnabled, gridUnitMm, heightUnitMm } = useDesignerStore(
    useShallow((s) => ({
      colorsEnabled: s.params.featureColors.enabled,
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
    }))
  );

  return useMemo(() => {
    const units = t('binDesigner.finishing.summary.units', {
      grid: gridUnitMm,
      height: heightUnitMm,
    });
    // Colours lead when they are on: a non-standard grid is the rarer edit but
    // the less visible one, so it stays legible either way.
    return colorsEnabled ? `${t('binDesigner.group.colors')} · ${units}` : units;
  }, [colorsEnabled, gridUnitMm, heightUnitMm, t]);
}
