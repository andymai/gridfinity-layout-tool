/**
 * Handle rest section: the saddle-topped part that carries the knife handles
 * lying past the block's open end.
 *
 * The style picker sits in the primary controls because it decides whether the
 * design gains a second part at all — `companion` prints its own Gridfinity
 * foot beside the block, `integrated` drops the block's rear section to rest
 * height instead — and the gap/depth fields only describe a companion.
 *
 * With no open-ended knife slot there is nothing for a rest to carry, so the
 * toggle is disabled with the reason rather than switching on a feature that
 * would generate nothing.
 */

import { useTranslation } from '@/i18n';
import { SegmentedControl } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import type { KnifeRestStyle } from '@/features/bin-designer/types';
import {
  KNIFE_REST_MAX_GAP_MM,
  KNIFE_REST_MIN_DEPTH_U,
  KNIFE_REST_MAX_DEPTH_U,
  KNIFE_REST_MIN_GROOVE_DEPTH_MM,
  KNIFE_REST_MAX_GROOVE_DEPTH_MM,
} from '@/features/bin-designer/types';
import { FeatureToggle } from '../FeatureToggle';
import { StepperField } from '../shared';
import { useKnifeRestSection } from './useKnifeRestSection';

const GAP_STEP_MM = 1;
const DEPTH_STEP_U = 0.5;
const GROOVE_STEP_MM = 0.5;

export function KnifeRestSection() {
  const t = useTranslation();
  const { state, meta, handlers } = useKnifeRestSection();

  const styleOptions: SegmentedControlOption<KnifeRestStyle>[] = [
    { value: 'companion', label: t('binDesigner.knifeRest.style.companion') },
    { value: 'integrated', label: t('binDesigner.knifeRest.style.integrated') },
  ];

  return (
    <FeatureToggle
      label={t('binDesigner.knifeRest.title')}
      checked={state.enabled}
      onChange={handlers.toggle}
      valueSummary={meta.summary}
      disabledReason={meta.disabledReason}
      primaryControls={
        <>
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.knifeRest.style')}
            </span>
            <SegmentedControl
              options={styleOptions}
              value={state.style}
              onChange={handlers.setStyle}
              aria-label={t('binDesigner.knifeRest.styleAria')}
              size="sm"
              fullWidth
            />
            <p className="mt-1 text-label leading-relaxed text-content-tertiary">
              {t(`binDesigner.knifeRest.styleHint.${state.style}`)}
            </p>
          </div>
          {state.style === 'companion' && (
            <div className="flex gap-2">
              <StepperField
                label={t('binDesigner.knifeRest.gap')}
                unit="mm"
                value={state.gapMm}
                onChange={handlers.setGapMm}
                onStep={(delta) => handlers.setGapMm(state.gapMm + delta * GAP_STEP_MM)}
                min={0}
                max={KNIFE_REST_MAX_GAP_MM}
                step={GAP_STEP_MM}
                size="md"
                aria-label={t('binDesigner.knifeRest.gapAria')}
              />
              <StepperField
                label={t('binDesigner.knifeRest.depth')}
                unit="u"
                value={state.depthU}
                onChange={handlers.setDepthU}
                onStep={(delta) => handlers.setDepthU(state.depthU + delta * DEPTH_STEP_U)}
                min={KNIFE_REST_MIN_DEPTH_U}
                max={KNIFE_REST_MAX_DEPTH_U}
                step={DEPTH_STEP_U}
                size="md"
                aria-label={t('binDesigner.knifeRest.depthAria')}
              />
            </div>
          )}
        </>
      }
    >
      <StepperField
        label={t('binDesigner.knifeRest.grooveDepth')}
        unit="mm"
        value={state.grooveDepthMm}
        onChange={handlers.setGrooveDepthMm}
        onStep={(delta) => handlers.setGrooveDepthMm(state.grooveDepthMm + delta * GROOVE_STEP_MM)}
        min={KNIFE_REST_MIN_GROOVE_DEPTH_MM}
        max={KNIFE_REST_MAX_GROOVE_DEPTH_MM}
        step={GROOVE_STEP_MM}
        size="md"
        aria-label={t('binDesigner.knifeRest.grooveDepthAria')}
      />
      <p className="text-label leading-relaxed text-content-tertiary">
        {t('binDesigner.knifeRest.grooveDepthHint')}
      </p>
    </FeatureToggle>
  );
}
