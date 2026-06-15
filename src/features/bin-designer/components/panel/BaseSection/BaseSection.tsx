/**
 * Base section: Magnet holes, screw holes, stacking lip, flat bottom.
 *
 * Uses smart defaults with "Customize" inline expansion for magnet/screw
 * radius and depth parameters that most users won't need to change.
 *
 * Disabled reasons are computed by the constraint engine via useBaseSection.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { useTranslation } from '@/i18n';
import { useBaseSection } from './useBaseSection';

export function BaseSection() {
  const { state, handlers } = useBaseSection();
  const t = useTranslation();

  return (
    <div className="space-y-3">
      <FeatureToggle
        label="Stacking lip"
        checked={state.base.stackingLip}
        onChange={handlers.toggleStackingLip}
      />

      <FeatureToggle
        label="Magnet holes"
        checked={state.hasMagnet}
        onChange={handlers.toggleMagnet}
        disabledReason={handlers.magnetDisabledReason}
        valueSummary={`\u00f8${state.base.magnetDiameter}mm \u00d7 ${state.base.magnetDepth}mm deep`}
      >
        <SliderInput
          label="Magnet diameter"
          value={state.base.magnetDiameter}
          onChange={handlers.setMagnetDiameter}
          min={DESIGNER_CONSTRAINTS.MIN_MAGNET_DIAMETER}
          max={DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER}
          step={DESIGNER_CONSTRAINTS.MAGNET_DIAMETER_STEP}
          unit="mm"
        />
        <SliderInput
          label="Magnet depth"
          value={state.base.magnetDepth}
          onChange={handlers.setMagnetHeight}
          min={DESIGNER_CONSTRAINTS.MIN_MAGNET_HEIGHT}
          max={DESIGNER_CONSTRAINTS.MAX_MAGNET_HEIGHT}
          step={DESIGNER_CONSTRAINTS.MAGNET_HEIGHT_STEP}
          unit="mm"
        />
      </FeatureToggle>

      <FeatureToggle
        label="Screw holes"
        checked={state.hasScrew}
        onChange={handlers.toggleScrew}
        disabledReason={handlers.screwDisabledReason}
        valueSummary={`\u00f8${state.base.screwDiameter}mm`}
      >
        <SliderInput
          label="Screw diameter"
          value={state.base.screwDiameter}
          onChange={handlers.setScrewDiameter}
          min={DESIGNER_CONSTRAINTS.MIN_SCREW_DIAMETER}
          max={DESIGNER_CONSTRAINTS.MAX_SCREW_DIAMETER}
          step={DESIGNER_CONSTRAINTS.SCREW_DIAMETER_STEP}
          unit="mm"
        />
      </FeatureToggle>

      <FeatureToggle
        label={t('binDesigner.flatFloor')}
        checked={state.isFlat}
        onChange={handlers.toggleFlat}
        disabledReason={handlers.flatDisabledReason}
      />

      <FeatureToggle
        label={t('binDesigner.halfSockets')}
        checked={state.hasHalfSockets}
        onChange={handlers.toggleHalfSockets}
        disabledReason={handlers.halfSocketsDisabledReason}
      />

      <FeatureToggle
        label={t('binDesigner.lightweight')}
        checked={state.hasLightweight}
        onChange={handlers.toggleLightweight}
        disabledReason={handlers.lightweightDisabledReason}
      />
    </div>
  );
}
