/** The collapsed "tab shape & size" group: support style, tab dimensions and the label lip. */

import { CheckboxRow } from '@/design-system';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { Button, Stepper, InfoIcon, Collapsible } from '@/design-system';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import type { LabelTabSupport } from '../../../types';
import type { useLabelTabsSection } from './useLabelTabsSection';
import type { ReactNode } from 'react';
import type { useTranslation } from '@/i18n';

const SUPPORT_OPTIONS: LabelTabSupport[] = ['bracket', 'solid', 'fillet'];

interface LabelTabShapeControlsProps {
  state: ReturnType<typeof useLabelTabsSection>['state'];
  handlers: ReturnType<typeof useLabelTabsSection>['handlers'];
  t: ReturnType<typeof useTranslation>;
  title: string;
  summary: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  badge?: ReactNode;
}

export function LabelTabShapeControls({
  state,
  handlers,
  t,
  title,
  summary,
  expanded,
  onExpandedChange,
  badge,
}: LabelTabShapeControlsProps) {
  return (
    <Collapsible
      title={title}
      summary={summary}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      size="sm"
      badge={badge}
    >
      <div className="space-y-3">
        {/* Support */}
        <div>
          <span className="mb-1 block text-label text-content-tertiary">
            {t('binDesigner.tabSupport')}
          </span>
          <div
            role="group"
            aria-label={t('binDesigner.tabSupport')}
            className={SEGMENT_GROUP_CLASS}
          >
            {SUPPORT_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant="ghost"
                touchTarget={false}
                onClick={() => handlers.setTabSupport(option)}
                aria-pressed={state.label.support === option}
                className={`flex-1 ${getSegmentClass(state.label.support === option)}`}
              >
                {t(`binDesigner.tabSupport.${option}`)}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.tabWidth')}
            </span>
            <Stepper
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
              size="md"
              aria-label={t('binDesigner.labelTabs.widthAria')}
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.tabDepth')}
            </span>
            <Stepper
              value={state.label.depth}
              onChange={handlers.setTabDepth}
              onStep={(delta) =>
                handlers.setTabDepth(
                  Math.min(
                    state.tabDepthMax,
                    Math.max(
                      state.tabDepthMin,
                      state.label.depth + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP
                    )
                  )
                )
              }
              min={state.tabDepthMin}
              max={state.tabDepthMax}
              step={DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP}
              size="md"
              aria-label={t('binDesigner.labelTabs.depthAria')}
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.tabHeight')}
            </span>
            <Stepper
              value={state.tabHeightMm}
              onChange={handlers.setTabHeight}
              onStep={(delta) =>
                handlers.setTabHeight(
                  Math.min(
                    state.tabHeightMax,
                    Math.max(
                      state.tabHeightMin,
                      state.tabHeightMm + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_HEIGHT_STEP
                    )
                  )
                )
              }
              min={state.tabHeightMin}
              max={state.tabHeightMax}
              step={DESIGNER_CONSTRAINTS.LABEL_TAB_HEIGHT_STEP}
              size="md"
              aria-label={t('binDesigner.labelTabs.heightAria')}
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.tabInset')}
            </span>
            <Stepper
              value={state.label.inset ?? 0}
              onChange={handlers.setTabInset}
              onStep={(delta) =>
                handlers.setTabInset(
                  Math.min(
                    state.tabInsetMax,
                    Math.max(
                      DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET,
                      (state.label.inset ?? 0) + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_INSET_STEP
                    )
                  )
                )
              }
              min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET}
              max={state.tabInsetMax}
              step={DESIGNER_CONSTRAINTS.LABEL_TAB_INSET_STEP}
              size="md"
              aria-label={t('binDesigner.labelTabs.insetAria')}
            />
          </div>
        </div>
        {/* Label lip: raised rim to retain loose labels (#2971).
              Text-mode only — socket plates retain themselves. */}
        {state.lipAvailable && (
          <div className="mt-3 border-t border-border-subtle pt-3">
            <CheckboxRow
              label={t('binDesigner.tabLip')}
              checked={state.lipEnabled}
              onChange={handlers.toggleLabelLip}
            />
            <p className="mt-0.5 pl-7 text-label leading-snug text-content-tertiary">
              {t('binDesigner.tabLipHint')}
            </p>
            {state.lipEnabled && (
              <div className="mt-2 min-w-0 pl-7">
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.tabLipHeight')}
                </span>
                <Stepper
                  value={state.lipHeightMm}
                  onChange={handlers.setLabelLipHeight}
                  onStep={(delta) =>
                    handlers.setLabelLipHeight(
                      Math.min(
                        state.lipMax,
                        Math.max(state.lipMin, state.lipHeightMm + delta * state.lipStep)
                      )
                    )
                  }
                  min={state.lipMin}
                  max={state.lipMax}
                  step={state.lipStep}
                  size="md"
                  aria-label={t('binDesigner.labelTabs.lipHeightAria')}
                />
              </div>
            )}
            {state.lipWontFit && (
              <div className="mt-1 flex items-start gap-2 pl-7 text-xs text-warning">
                <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                <span className="flex-1">{t('binDesigner.tabLipTooTallWarning')}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  touchTarget={false}
                  onClick={handlers.autoFixLip}
                  className="shrink-0 px-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
                >
                  {t('binDesigner.tabAutoFix')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Collapsible>
  );
}
