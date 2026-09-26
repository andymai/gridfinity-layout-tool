/**
 * Interior fillet: rounds every compartment's wall-to-floor edges and its
 * vertical corners to one radius, the look of a cup rather than a box.
 */

import { SliderInput } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useInteriorFilletSection } from './useInteriorFilletSection';

const { MIN_INTERIOR_FILLET, MAX_INTERIOR_FILLET, INTERIOR_FILLET_STEP } = DESIGNER_CONSTRAINTS;

export function InteriorFilletSection() {
  const { state, handlers, meta, t } = useInteriorFilletSection();

  return (
    <FeatureToggle
      label={t('binDesigner.interiorFillet.label')}
      checked={state.enabled}
      onChange={handlers.toggle}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
      primaryControls={
        <div className="flex flex-col gap-2">
          <p className="text-label text-content-tertiary">{t('binDesigner.interiorFillet.help')}</p>
          <SliderInput
            label={t('binDesigner.interiorFillet.radius')}
            value={state.radius}
            onChange={handlers.setRadius}
            min={MIN_INTERIOR_FILLET}
            max={MAX_INTERIOR_FILLET}
            step={INTERIOR_FILLET_STEP}
            unit="mm"
          />
          {state.clamped && (
            <p className="text-label text-content-tertiary">
              {t('binDesigner.interiorFillet.clamped')}
            </p>
          )}
        </div>
      }
    />
  );
}
