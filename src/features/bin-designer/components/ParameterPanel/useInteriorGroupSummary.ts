import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getCompartmentCount } from '../../utils/compartments';
import { useTranslation } from '@/i18n';

/** Read-only summary for the Interior group when collapsed. */
export function useInteriorGroupSummary(): string {
  const { compartments, style, label, cutoutCount } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      style: s.params.style,
      label: s.params.label,
      cutoutCount: s.params.cutouts.length,
    }))
  );
  const t = useTranslation();

  return useMemo(() => {
    const isSolid = style === 'solid';
    const isSlotted = style === 'slotted';

    const interiorPart = isSolid
      ? cutoutCount > 0
        ? t('binDesigner.cutouts.summary', { count: cutoutCount })
        : t('binDesigner.solidInteriorSummary')
      : isSlotted
        ? t('binDesigner.slottedInteriorSummary')
        : t('binDesigner.interiorSummary', { count: getCompartmentCount(compartments) });

    const parts = [interiorPart];
    if (label.enabled && !isSlotted && !isSolid) {
      parts.push(t('binDesigner.labelTabs'));
    }

    return parts.join(' \u00b7 ');
  }, [compartments, style, label.enabled, cutoutCount, t]);
}
