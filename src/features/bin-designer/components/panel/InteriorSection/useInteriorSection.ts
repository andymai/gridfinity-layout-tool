import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getCompartmentCount } from '../../../utils/compartments';
import { useTranslation } from '@/i18n';
import type { BinStyle } from '../../../types';

export function useInteriorSection() {
  const { compartments, style, cutoutCount, setParam, updateBase, updateWallPattern } =
    useDesignerStore(
      useShallow((s) => ({
        compartments: s.params.compartments,
        style: s.params.style,
        cutoutCount: s.params.cutouts.length,
        setParam: s.setParam,
        updateBase: s.updateBase,
        updateWallPattern: s.updateWallPattern,
      }))
    );
  const t = useTranslation();

  const setStyle = useCallback(
    (newStyle: BinStyle) => {
      setParam('style', newStyle);
      updateBase({ solid: newStyle === 'solid' });
      // Disable wall patterns when switching to cutout mode
      if (newStyle === 'solid') {
        updateWallPattern({ enabled: false });
      }
    },
    [setParam, updateBase, updateWallPattern]
  );

  const isSlotted = style === 'slotted';
  const isSolid = style === 'solid';
  const compartmentCount = getCompartmentCount(compartments);

  // Calculate summary for each mode (not just current)
  const standardSummary = t('binDesigner.interiorSummary', { count: compartmentCount });
  const slottedSummary = t('binDesigner.slottedInteriorSummary');
  const solidSummary =
    cutoutCount > 0 ? t('binDesigner.cutouts.summary', { count: cutoutCount }) : undefined;

  return {
    state: { style, isSlotted, isSolid },
    handlers: { setStyle },
    summaries: {
      standard: standardSummary,
      slotted: slottedSummary,
      solid: solidSummary,
    },
  };
}
