/**
 * Label tabs section: configurable shelf tabs on the back wall of each compartment.
 *
 * All controls are visible immediately when the feature is toggled on:
 * style picker, width, depth, and alignment.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { LabelTabsIcon } from '../SectionIllustrations';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '../../../constants';
import { useTranslation } from '@/i18n';
import type { LabelTabAlignment, LabelTabSupport } from '../../../types';

const ALIGNMENT_OPTIONS: LabelTabAlignment[] = ['left', 'center', 'right'];
const SUPPORT_OPTIONS: LabelTabSupport[] = ['bracket', 'solid'];

export function LabelTabsSection() {
  const { compartments, label, style, width, wallThickness, setParam } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      label: s.params.label,
      style: s.params.style,
      width: s.params.width,
      wallThickness: s.params.wallThickness,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const isSolid = style === 'solid';

  const toggleLabelTabs = useCallback(() => {
    setParam('label', { ...label, enabled: !label.enabled });
  }, [label, setParam]);

  const setTabSupport = useCallback(
    (support: LabelTabSupport) => {
      setParam('label', { ...label, support });
    },
    [label, setParam]
  );

  const setTabDepth = useCallback(
    (depth: number) => {
      setParam('label', { ...label, depth });
    },
    [label, setParam]
  );

  const setTabWidth = useCallback(
    (w: number) => {
      setParam('label', { ...label, width: w });
    },
    [label, setParam]
  );

  const setTabAlignment = useCallback(
    (alignment: LabelTabAlignment) => {
      setParam('label', { ...label, alignment });
    },
    [label, setParam]
  );

  // Compute actual tab width in mm for display
  const tabWidthMm = useMemo(() => {
    const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const innerW = outerW - 2 * wallThickness;
    const cellW = innerW / compartments.cols;
    let availableWidth = cellW;
    if (compartments.cols === 2) {
      // Two columns: edge columns only, subtract half divider thickness
      availableWidth -= compartments.thickness / 2;
    } else if (compartments.cols >= 3) {
      // Three or more columns: middle columns subtract full divider thickness
      availableWidth -= compartments.thickness;
    }
    return Math.round(((availableWidth * label.width) / 100) * 10) / 10;
  }, [width, wallThickness, compartments.cols, compartments.thickness, label.width]);

  // Summary for the collapsed section header
  const sectionSummary = useMemo(() => {
    if (!label.enabled) return undefined;
    const supportName = t(`binDesigner.tabSupport.${label.support}`);
    const parts = [supportName, `${label.width}%`];
    if (label.alignment !== 'left') {
      parts.push(t(`binDesigner.alignment.${label.alignment}`));
    }
    return parts.join(' · ');
  }, [label.enabled, label.support, label.width, label.alignment, t]);

  if (isSolid) return null;

  return (
    <CollapsibleSection
      title={t('binDesigner.labelTabs')}
      defaultExpanded
      illustration={<LabelTabsIcon />}
      summary={sectionSummary}
    >
      <FeatureToggle
        label={t('binDesigner.labelTabs')}
        checked={label.enabled}
        onChange={toggleLabelTabs}
        primaryControls={
          <>
            {/* Width + Depth steppers side by side */}
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.tabWidth')}
                </span>
                <StepperControl
                  value={label.width}
                  onChange={setTabWidth}
                  onStep={(delta) =>
                    setTabWidth(
                      Math.min(
                        DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH,
                        Math.max(
                          DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH,
                          label.width + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_WIDTH_STEP
                        )
                      )
                    )
                  }
                  min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH}
                  max={DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH}
                  step={DESIGNER_CONSTRAINTS.LABEL_TAB_WIDTH_STEP}
                  variant="desktop"
                  ariaLabel="Tab width"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.tabDepth')}
                </span>
                <StepperControl
                  value={label.depth}
                  onChange={setTabDepth}
                  onStep={(delta) =>
                    setTabDepth(
                      Math.min(
                        DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH,
                        Math.max(
                          DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH,
                          label.depth + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP
                        )
                      )
                    )
                  }
                  min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH}
                  max={DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH}
                  step={DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP}
                  variant="desktop"
                  ariaLabel="Tab depth"
                />
              </div>
            </div>

            {/* Physical tab dimensions */}
            <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
                />
              </svg>
              <span className="tabular-nums">
                {tabWidthMm} × {label.depth} mm
              </span>
            </div>

            {/* Alignment */}
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">
                {t('binDesigner.tabAlignment')}
              </label>
              <div className="flex gap-1">
                {ALIGNMENT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTabAlignment(option)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      label.alignment === option
                        ? 'bg-accent text-white'
                        : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {t(`binDesigner.alignment.${option}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Support picker */}
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">
                {t('binDesigner.tabSupport')}
              </label>
              <div className="flex gap-1">
                {SUPPORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTabSupport(option)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      label.support === option
                        ? 'bg-accent text-white'
                        : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {t(`binDesigner.tabSupport.${option}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        }
      />
    </CollapsibleSection>
  );
}
