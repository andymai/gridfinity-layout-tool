import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import { getCompartmentIds } from '../../../utils/compartments';
import type { LabelTabAlignment, LabelTabSupport, TextFontFamily, TextMode } from '../../../types';

export function useLabelTabsSection() {
  const {
    compartments,
    label,
    textDefaults,
    height,
    updateLabel,
    setCompartmentText,
    setTextDefaults,
    params,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      label: s.params.label,
      textDefaults: s.params.textDefaults,
      height: s.params.height,
      updateLabel: s.updateLabel,
      setCompartmentText: s.setCompartmentText,
      setTextDefaults: s.setTextDefaults,
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

  // Interior cavity height — dynamic max for the tab-height stepper and
  // the cap for the `setTabDepth` height-clamp. Matches `wallHeight`
  // passed to the geometry builder.
  const wallHeightMm = useMemo(() => binDimensions(params).wallHeight, [params]);

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
      // Height (when explicitly set) must stay above `depth` so the gusset
      // has at least 1mm of clearance above the floor. If raising depth
      // would invalidate the current height, lift height in lockstep — and
      // cap at `wallHeightMm` so we never write a value above the stepper's
      // own ceiling. Without the cap, pushing depth up to wallHeight on a
      // short bin would store height = depth + 1 > wallHeight; subsequently
      // lowering depth wouldn't re-trigger the clamp (`currentHeight <= depth`
      // is false), and the now-out-of-range height would silently make the
      // builder drop the tab.
      const currentHeight = label.height;
      if (currentHeight !== undefined && currentHeight <= depth) {
        updateLabel({ depth, height: Math.min(depth + 1, wallHeightMm) });
      } else {
        updateLabel({ depth });
      }
    },
    [label.height, updateLabel, wallHeightMm]
  );

  const setTabHeight = useCallback(
    (h: number) => {
      updateLabel({ height: h });
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

  const setTextFont = useCallback(
    (font: TextFontFamily) => {
      setTextDefaults({ font });
    },
    [setTextDefaults]
  );

  const setTextMode = useCallback(
    (mode: TextMode) => {
      setTextDefaults({ mode });
    },
    [setTextDefaults]
  );

  const setTextDepth = useCallback(
    (depth: number) => {
      setTextDefaults({ depth });
    },
    [setTextDefaults]
  );

  const tabWidthMm = useMemo(() => {
    const { innerW } = binDimensions(params);
    const cellW = innerW / compartments.cols;
    let availableWidth = cellW;
    if (compartments.cols === 2) {
      availableWidth -= compartments.thickness / 2;
    } else if (compartments.cols >= 3) {
      availableWidth -= compartments.thickness;
    }
    return Math.round(((availableWidth * label.width) / 100) * 10) / 10;
  }, [params, compartments.cols, compartments.thickness, label.width]);

  // Resolved tab height for display: explicit value when set, otherwise
  // wall top (the default-when-absent contract from `LabelTabConfig`).
  const tabHeightMm = label.height ?? wallHeightMm;
  // Did the user explicitly set height? Controls whether the W×D×H summary
  // shows the third dimension. Keeps unaltered designs visually unchanged.
  const heightIsExplicit = label.height !== undefined;

  // Dynamic min/max for the tab-height stepper. The geometry layer
  // requires `height > depth` for a non-degenerate gusset (floor = depth + 1)
  // and `height <= wallHeight` (ceiling = interior wall height).
  // When the depth-derived floor exceeds the wall ceiling (a deep tab in a
  // short bin), the only valid value is the wall top; collapse min onto max
  // so the stepper can't request a Z the builder would reject — never let
  // the stepper expose a max above the actual wall height.
  const tabHeightMax = wallHeightMm;
  const tabHeightMin = Math.min(label.depth + 1, tabHeightMax);

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
    // `displayNumber` is the source of truth for what the user sees AND what
    // the aria-label announces — keep them in lockstep so a future change
    // to ID ordering can't silently desync the two.
    return ids.map((id, idx) => {
      const displayNumber = idx + 1;
      return {
        id,
        displayNumber,
        label: t('binDesigner.compartmentNumberLabel', { n: displayNumber }),
        value: texts[id] ?? '',
      };
    });
  }, [compartments, t]);

  return {
    state: {
      label,
      textDefaults,
      isUnavailable,
      tabWidthMm,
      tabHeightMm,
      heightIsExplicit,
      tabHeightMin,
      tabHeightMax,
      compartmentTextRows,
    },
    handlers: {
      toggleLabelTabs,
      setTabSupport,
      setTabDepth,
      setTabWidth,
      setTabHeight,
      setTabAlignment,
      setCompartmentText,
      setTextFont,
      setTextMode,
      setTextDepth,
    },
    meta,
    t,
  };
}
