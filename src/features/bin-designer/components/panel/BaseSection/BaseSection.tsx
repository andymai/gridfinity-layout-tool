/**
 * Base section: Magnet holes, screw holes, stacking lip, flat bottom, floor
 * pattern.
 *
 * Uses smart defaults with "Customize" inline expansion for magnet/screw
 * radius and depth parameters that most users won't need to change.
 *
 * Disabled reasons are computed by the constraint engine via useBaseSection.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { PatternSelector } from '../WallsSection/PatternSelector';
import { FLOOR_PATTERN_TYPES } from '@/features/bin-designer/types';
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

      {/* ── Floor pattern (#2816) — drainage / ventilation. The holes pass
          through the floor slab AND the feet, staying inside each foot's flat
          underside so the baseplate-mating taper is never cut. */}
      <FeatureToggle
        label={t('binDesigner.base.floorPattern')}
        checked={state.floorPatternEnabled}
        onChange={handlers.toggleFloorPattern}
        disabledReason={handlers.floorPatternDisabledReason}
        primaryControls={
          <>
            <PatternSelector
              id="floor-pattern-selector"
              labelKey="binDesigner.base.floorPattern.shape"
              patterns={FLOOR_PATTERN_TYPES}
              selectedPattern={state.floorPatternType}
              onChange={handlers.setFloorPatternType}
            />
            <SliderInput
              label={t('binDesigner.walls.pattern.scale')}
              value={state.floorPatternScalePercent}
              onChange={handlers.setFloorPatternScale}
              min={0}
              max={100}
              step={5}
              unit="%"
              info={t('binDesigner.walls.pattern.scaleHint')}
            />
            <p className="text-[11px] leading-relaxed text-content-tertiary">
              {state.floorPatternDoesNotFit
                ? t('binDesigner.base.floorPattern.tooSmall')
                : t('binDesigner.base.floorPattern.hint')}
            </p>
          </>
        }
      />
    </div>
  );
}
