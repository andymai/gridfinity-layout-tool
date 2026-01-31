import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getCompartmentCount } from '../../../utils/compartments';
import { useTranslation } from '@/i18n';
import type { BinStyle } from '../../../types';
import type { SectionMeta } from '../types';

export function useInteriorSection() {
  const { compartments, style, setParam } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      style: s.params.style,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
      setParam('style', newStyle);
    },
    [setParam]
  );

  const isSlotted = style === 'slotted';
  const compartmentCount = getCompartmentCount(compartments);

  const summary = useMemo(
    () =>
      isSlotted
        ? t('binDesigner.slottedInteriorSummary')
        : t('binDesigner.interiorSummary', { count: compartmentCount }),
    [isSlotted, compartmentCount, t]
  );

  const meta: SectionMeta = useMemo(() => ({ summary }), [summary]);

  return {
    state: { style, isSlotted },
    handlers: { setStyle },
    meta,
    t,
  };
}
