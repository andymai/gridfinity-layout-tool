/**
 * Label tabs section: configurable shelf tabs on the back wall of each compartment.
 *
 * All controls are visible immediately when the feature is toggled on:
 * style picker, width, depth, and alignment.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import type { LabelTabAlignment, LabelTabSupport } from '../../../types';
import { useLabelTabsSection } from './useLabelTabsSection';

const ALIGNMENT_OPTIONS: LabelTabAlignment[] = ['left', 'center', 'right'];
const SUPPORT_OPTIONS: LabelTabSupport[] = ['bracket', 'solid'];

export function LabelTabsSection() {
  const { state, handlers, meta, t } = useLabelTabsSection();

  return (
    <CollapsibleSection title={t('binDesigner.labelTabs')} defaultExpanded summary={meta.summary}>
      <FeatureToggle
        label={t('binDesigner.labelTabs')}
        checked={state.label.enabled}
        onChange={handlers.toggleLabelTabs}
        disabledReason={meta.disabledReason}
        primaryControls={
          <>
            {/* Width + Depth steppers side by side */}
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.tabWidth')}
                </span>
                <StepperControl
                  value={state.label.width}
                  onChange={handlers.setTabWidth}
                  onStep={(delta) =>
                    handlers.setTabWidth(
                      Math.min(
                        DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH,
                        Math.max(
                          DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH,
                          state.label.width + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_WIDTH_STEP
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
                  value={state.label.depth}
                  onChange={handlers.setTabDepth}
                  onStep={(delta) =>
                    handlers.setTabDepth(
                      Math.min(
                        DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH,
                        Math.max(
                          DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH,
                          state.label.depth + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP
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
                {state.tabWidthMm} × {state.label.depth} mm
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
                    onClick={() => handlers.setTabAlignment(option)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      state.label.alignment === option
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
                    onClick={() => handlers.setTabSupport(option)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      state.label.support === option
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
