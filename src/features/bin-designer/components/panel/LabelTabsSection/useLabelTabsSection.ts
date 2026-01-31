import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '../../../constants';
import { useTranslation } from '@/i18n';
import type { LabelTabAlignment, LabelTabSupport } from '../../../types';
import type { SectionMeta } from '../types';

export function useLabelTabsSection() {
  const { compartments, label, style, width, wallThickness, updateLabel } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      label: s.params.label,
      style: s.params.style,
      width: s.params.width,
      wallThickness: s.params.wallThickness,
      updateLabel: s.updateLabel,
    }))
  );
  const t = useTranslation();

  const isSlotted = style === 'slotted';

  const toggleLabelTabs = useCallback(() => {
    updateLabel({ enabled: !label.enabled });
  }, [label.enabled, updateLabel]);

  const setTabSupport = useCallback(
    (support: LabelTabSupport) => {
      updateLabel({ support });
    },
    [updateLabel]
  );

  const setTabDepth = useCallback(
    (depth: number) => {
      updateLabel({ depth });
    },
    [updateLabel]
  );

  const setTabWidth = useCallback(
    (w: number) => {
      updateLabel({ width: w });
    },
    [updateLabel]
  );

  const setTabAlignment = useCallback(
    (alignment: LabelTabAlignment) => {
      updateLabel({ alignment });
    },
    [updateLabel]
  );

  const tabWidthMm = useMemo(() => {
    const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const innerW = outerW - 2 * wallThickness;
    const cellW = innerW / compartments.cols;
    let availableWidth = cellW;
    if (compartments.cols === 2) {
      availableWidth -= compartments.thickness / 2;
    } else if (compartments.cols >= 3) {
      availableWidth -= compartments.thickness;
    }
    return Math.round(((availableWidth * label.width) / 100) * 10) / 10;
  }, [width, wallThickness, compartments.cols, compartments.thickness, label.width]);

  const sectionSummary = useMemo(() => {
    if (!label.enabled) return undefined;
    const supportName = t(`binDesigner.tabSupport.${label.support}`);
    const parts = [supportName, `${label.width}%`];
    if (label.alignment !== 'left') {
      parts.push(t(`binDesigner.alignment.${label.alignment}`));
    }
    return parts.join(' \u00b7 ');
  }, [label.enabled, label.support, label.width, label.alignment, t]);

  const disabledReason = isSlotted ? t('binDesigner.labelTabsUnavailableSlotted') : undefined;

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isSlotted ? undefined : sectionSummary,
      disabledReason,
    }),
    [isSlotted, sectionSummary, disabledReason]
  );

  return {
    state: { label, isSlotted, tabWidthMm },
    handlers: { toggleLabelTabs, setTabSupport, setTabDepth, setTabWidth, setTabAlignment },
    meta,
    t,
  };
}
