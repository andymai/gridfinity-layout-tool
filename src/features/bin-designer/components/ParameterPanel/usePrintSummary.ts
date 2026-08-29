import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';

/** Physical-units summary for the Print rail tooltip. */
export function usePrintSummary(): string {
  const t = useTranslation();
  const { gridUnitMm, heightUnitMm } = useDesignerStore(
    useShallow((s) => ({
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
    }))
  );

  return useMemo(
    () => t('binDesigner.finishing.summary.units', { grid: gridUnitMm, height: heightUnitMm }),
    [gridUnitMm, heightUnitMm, t]
  );
}
