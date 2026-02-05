import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getCompartmentCount } from '../../../utils/compartments';
import { useTranslation } from '@/i18n';
import type { BinStyle } from '../../../types';
import type { SectionMeta } from '../types';

export function useInteriorSection() {
  const { compartments, style, cutoutCount, setParam, updateBase } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      style: s.params.style,
      cutoutCount: s.params.cutouts.length,
      setParam: s.setParam,
      updateBase: s.updateBase,
    }))
  );
  const t = useTranslation();

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
      setParam('style', newStyle);
      updateBase({ solid: newStyle === 'solid' });
    },
    [setParam, updateBase]
  );

  const isSlotted = style === 'slotted';
  const isSolid = style === 'solid';
  const compartmentCount = getCompartmentCount(compartments);

  const summary = useMemo(
    () =>
      isSolid
        ? cutoutCount > 0
          ? t('binDesigner.cutouts.summary', { count: cutoutCount })
          : undefined
        : isSlotted
          ? t('binDesigner.slottedInteriorSummary')
          : t('binDesigner.interiorSummary', { count: compartmentCount }),
    [isSolid, isSlotted, compartmentCount, cutoutCount, t]
  );

  const meta: SectionMeta = useMemo(() => ({ summary }), [summary]);

  return {
    state: { style, isSlotted, isSolid },
    handlers: { setStyle },
    meta,
    t,
  };
}
