import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '../../../constants';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import { getCompartmentIds } from '../../../utils/compartments';
import type { LabelTabAlignment, LabelTabSupport } from '../../../types';

export function useLabelTabsSection() {
  const {
    compartments,
    label,
    width,
    height,
    wallThickness,
    updateLabel,
    setCompartmentText,
    params,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      label: s.params.label,
      width: s.params.width,
      height: s.params.height,
      wallThickness: s.params.wallThickness,
      updateLabel: s.updateLabel,
      setCompartmentText: s.setCompartmentText,
      params: s.params,
    }))
  );
  const t = useTranslation();

  const labelStatus = getFeatureStatus(params, 'label');
  // Dimensional constraint: cavity too shallow for label tab support at min height.
  // Handled here (not in constraint engine) because ConstraintRule.source requires a
  // FeatureKey, and "height" is a dimension, not a toggleable feature.
  const tooShort = height <= DESIGNER_CONSTRAINTS.MIN_HEIGHT;
  const isUnavailable = !labelStatus.available || tooShort;

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

  const disabledReason = tooShort
    ? t('binDesigner.labelTabsUnavailableMinHeight')
    : labelStatus.reason
      ? t(labelStatus.reason)
      : undefined;

  const meta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : sectionSummary,
      disabledReason,
    }),
    [isUnavailable, sectionSummary, disabledReason]
  );

  const compartmentTextRows = useMemo(() => {
    const ids = getCompartmentIds(compartments);
    const texts = compartments.compartmentTexts ?? [];
    return ids.map((id, idx) => ({
      id,
      label: t('binDesigner.compartmentNumberLabel', { n: idx + 1 }),
      value: texts[id] ?? '',
    }));
  }, [compartments, t]);

  return {
    state: { label, isUnavailable, tabWidthMm, compartmentTextRows },
    handlers: {
      toggleLabelTabs,
      setTabSupport,
      setTabDepth,
      setTabWidth,
      setTabAlignment,
      setCompartmentText,
    },
    meta,
    t,
  };
}
