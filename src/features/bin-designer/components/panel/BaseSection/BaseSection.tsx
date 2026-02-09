/**
 * Base section: Magnet holes, screw holes, stacking lip, flat bottom.
 *
 * Uses smart defaults with "Customize" inline expansion for magnet/screw
 * radius and depth parameters that most users won't need to change.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { SliderInput } from '../../controls/SliderInput';
import { FeatureToggle } from '../FeatureToggle';
import { useTranslation } from '@/i18n';
import { useBaseSection } from './useBaseSection';

export function BaseSection() {
  const { state, handlers, meta } = useBaseSection();
  const t = useTranslation();

  return (
    <CollapsibleSection title={t('binDesigner.base')} defaultExpanded={true} summary={meta.summary}>
      <div className="space-y-1">
        <FeatureToggle
          label="Stacking lip"
          checked={state.base.stackingLip}
          onChange={handlers.toggleStackingLip}
        />

        <FeatureToggle
          label="Magnet holes"
          checked={state.hasMagnet}
          onChange={handlers.toggleMagnet}
          disabledReason={
            state.hasHalfSockets
              ? t('binDesigner.halfSocketsDisablesMagnetHoles')
              : handlers.flatDisabledReason
          }
          valueSummary={`\u00f8${state.base.magnetDiameter}mm \u00d7 ${state.base.magnetDepth}mm deep`}
        >
          <SliderInput
            label="Magnet radius"
            value={state.base.magnetDiameter / 2}
            onChange={handlers.setMagnetRadius}
            min={DESIGNER_CONSTRAINTS.MIN_MAGNET_RADIUS}
            max={DESIGNER_CONSTRAINTS.MAX_MAGNET_RADIUS}
            step={DESIGNER_CONSTRAINTS.MAGNET_RADIUS_STEP}
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
          disabledReason={
            state.hasHalfSockets
              ? t('binDesigner.halfSocketsDisablesScrewHoles')
              : handlers.flatDisabledReason
          }
          valueSummary={`\u00f8${state.base.screwDiameter}mm (M${state.base.screwDiameter})`}
        >
          <SliderInput
            label="Screw radius"
            value={state.base.screwDiameter / 2}
            onChange={handlers.setScrewRadius}
            min={DESIGNER_CONSTRAINTS.MIN_SCREW_RADIUS}
            max={DESIGNER_CONSTRAINTS.MAX_SCREW_RADIUS}
            step={DESIGNER_CONSTRAINTS.SCREW_RADIUS_STEP}
            unit="mm"
          />
        </FeatureToggle>

        <FeatureToggle
          label={t('binDesigner.flatFloor')}
          checked={state.isFlat}
          onChange={handlers.toggleFlat}
          disabledReason={
            state.hasHalfSockets ? t('binDesigner.halfSocketsDisablesFlatFloor') : undefined
          }
        />

        <FeatureToggle
          label="Half sockets"
          checked={state.hasHalfSockets}
          onChange={handlers.toggleHalfSockets}
          disabledReason={handlers.halfSocketsDisabledReason}
        />
      </div>
    </CollapsibleSection>
  );
}
