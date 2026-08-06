/**
 * Base section: Magnet holes, screw holes, stacking lip, flat bottom,
 * lid-compatible bottom, floor pattern.
 *
 * Uses smart defaults with "Customize" inline expansion for magnet/screw
 * radius and depth parameters that most users won't need to change.
 *
 * Disabled reasons are computed by the constraint engine via useBaseSection.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { Button, SegmentedControl, SliderInput } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { PatternSelector } from '../WallsSection/PatternSelector';
import {
  FLOOR_PATTERN_TYPES,
  LID_ATTACHMENTS,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_RAIL_SIDES,
} from '@/features/bin-designer/types';
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

      {/* Lid-compatible bottom (#3036). The attachment and rail controls reuse
          the lid section's copy: it is the same joint from the other side. */}
      <FeatureToggle
        label={t('binDesigner.lidBottom')}
        checked={state.isLidBottom}
        onChange={handlers.toggleLidBottom}
        disabledReason={handlers.lidBottomDisabledReason}
      >
        <div className="space-y-3">
          <p className="text-xs text-content-tertiary">{t('binDesigner.lidBottom.hint')}</p>

          <SegmentedControl
            aria-label={t('binDesigner.lid.attachment')}
            activeStyle="accent"
            fullWidth
            size="sm"
            value={state.trayBottom.attachment}
            onChange={handlers.setTrayAttachment}
            options={LID_ATTACHMENTS.map((mode) => ({
              value: mode,
              label: t(`binDesigner.lid.attachment.${mode}`),
            }))}
          />

          <SliderInput
            label={t('binDesigner.lidBottom.extraHeight')}
            value={state.trayBottom.extraHeightMm}
            onChange={handlers.setTrayExtraHeight}
            min={LID_EXTRA_HEIGHT_MIN_MM}
            max={LID_EXTRA_HEIGHT_MAX_MM}
            step={0.5}
            unit="mm"
          />

          {state.trayBottom.attachment === 'clickRails' && (
            <div>
              <span className="mb-1 block text-xs font-medium text-content-secondary">
                {t('binDesigner.lid.clickRails')}
              </span>
              <div className="flex gap-1">
                {LID_RAIL_SIDES.map((side) => (
                  <Button
                    key={side}
                    size="sm"
                    variant={state.trayBottom.clickRails[side] ? 'primary' : 'secondary'}
                    aria-pressed={state.trayBottom.clickRails[side]}
                    onClick={() => handlers.toggleTrayRail(side)}
                  >
                    {t(`binDesigner.lid.side.${side}`)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </FeatureToggle>

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

      {/* ── Spacer / riser (#2869) — a floorless frame that lifts a bin so bins
          of different heights finish flush. Height counts in the stack exactly
          like a bin of the same height, so a 2u spacer under a 2u bin reaches
          the top of a 4u one. */}
      <FeatureToggle
        label={t('binDesigner.spacer')}
        checked={state.isSpacer}
        onChange={handlers.toggleSpacer}
        disabledReason={handlers.spacerDisabledReason}
        primaryControls={
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            {t('binDesigner.spacerHint')}
          </p>
        }
      />

      {/* ── Base-only bin — the spacer's complement. The spacer keeps the walls
          and drops the floor; this keeps the floor and drops the walls, leaving
          the stacking lip as the only raised edge (or nothing above the slab,
          with the lip cleared). Placed directly after the spacer so the pair
          reads as the two halves it is. */}
      <FeatureToggle
        label={t('binDesigner.tile')}
        checked={state.isTile}
        onChange={handlers.toggleTile}
        disabledReason={handlers.tileDisabledReason}
        primaryControls={
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            {t('binDesigner.tileHint')}
          </p>
        }
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
