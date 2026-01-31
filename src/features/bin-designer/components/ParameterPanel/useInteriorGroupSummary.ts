import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getCompartmentCount } from '../../utils/compartments';
import { useTranslation } from '@/i18n';

/** Read-only summary for the Interior group when collapsed. */
export function useInteriorGroupSummary(): string {
  const { compartments, style, label } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      style: s.params.style,
      label: s.params.label,
    }))
  );
  const t = useTranslation();

  return useMemo(() => {
    const isSlotted = style === 'slotted';
    const interiorPart = isSlotted
      ? t('binDesigner.slottedInteriorSummary')
      : t('binDesigner.interiorSummary', { count: getCompartmentCount(compartments) });

    const parts = [interiorPart];
    if (label.enabled && !isSlotted) {
      parts.push(t('binDesigner.labelTabs'));
    }

    return parts.join(' \u00b7 ');
  }, [compartments, style, label.enabled, t]);
}
