/** The lid's millimetre fine-tuning disclosure: plate thickness, mode-specific clearances, seam relief, tray dims. */

import { useState } from 'react';
import { Collapsible } from '@/design-system';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { StepperField } from '../shared/StepperField';
import { Hint, Readout } from '../shared';
import type { useTranslation } from '@/i18n';
import { FeatureToggle } from '../FeatureToggle';
import type { useLidSection } from './useLidSection';

type Translator = ReturnType<typeof useTranslation>;

export function LidAdvancedFields({
  state,
  handlers,
  t,
}: {
  state: ReturnType<typeof useLidSection>['state'];
  handlers: ReturnType<typeof useLidSection>['handlers'];
  t: Translator;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Which mode-specific knobs the Advanced disclosure holds depends on the
  // current mode; the floor-plate thickness applies to every lid, so the
  // disclosure is always present now and never renders empty.
  const showMagnetAdvanced = state.attachment === 'magnetic';
  const showCoverageAdvanced = state.attachment === 'clickRails' && state.anyRail;
  // A sliding lid has no top surface to recess, no cavity to deepen and no seam
  // to relieve, so those three sections are hidden rather than shown inert. The
  // stored values survive — `resolveLidInputs` forces the geometry off without
  // touching the config — so switching attachment back restores them.
  const showTrayAdvanced = state.topSurface === 'tray' && !state.isSlide;

  // On a tray lid the geometry holds the floor at LID_TRAY_FLOOR even if the
  // design stored something thinner, so the field reads back from the resolver
  // rather than the raw param — otherwise it would sit directly above the
  // breakdown showing a number the part does not use.
  const shownThickness = state.trayBreakdown ? state.trayBreakdown.floorMm : state.topThicknessMm;

  return (
    <Collapsible
      title={t('binDesigner.lid.advanced')}
      size="sm"
      expanded={advancedOpen}
      onExpandedChange={setAdvancedOpen}
    >
      <div className="space-y-3 pt-2">
        <div className="space-y-1">
          <StepperField
            label={
              state.trayBreakdown
                ? t('binDesigner.lid.trayFloorThickness')
                : t('binDesigner.lid.topThickness')
            }
            unit="mm"
            value={shownThickness}
            onChange={handlers.setTopThickness}
            // Step from the SHOWN value, not the stored one. They differ
            // on a tray lid whose design stored less than the geometry
            // uses, and stepping from the stored value made the first
            // click compute a number that clamped straight back to what
            // was already displayed — a control that looked dead.
            onStep={(delta) =>
              handlers.setTopThickness(shownThickness + delta * state.topThicknessStep)
            }
            min={state.topThicknessMin}
            max={state.topThicknessMax}
            step={state.topThicknessStep}
            size="md"
            aria-label={
              state.trayBreakdown
                ? t('binDesigner.lid.trayFloorThicknessAria')
                : t('binDesigner.lid.topThicknessAria')
            }
            commitMode="deferred"
          />
          {/* A tray splits the plate into recess + floor, and the field
              sets the floor — without the arithmetic spelled out, the
              overall thickness looks unrelated to what was typed (#3072). */}
          {state.trayBreakdown && (
            <dl className="text-content-tertiary space-y-0.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt>{t('binDesigner.lid.trayBreakdownRecess')}</dt>
                <dd className="tabular-nums">{state.trayBreakdown.recessMm.toFixed(1)} mm</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t('binDesigner.lid.trayBreakdownFloor')}</dt>
                <dd className="tabular-nums">{state.trayBreakdown.floorMm.toFixed(1)} mm</dd>
              </div>
              <div className="text-content-secondary flex justify-between gap-2 font-medium">
                <dt>{t('binDesigner.lid.trayBreakdownOverall')}</dt>
                <dd className="tabular-nums">{state.trayBreakdown.overallMm.toFixed(1)} mm</dd>
              </div>
            </dl>
          )}
          <Hint>
            {state.trayBreakdown
              ? t('binDesigner.lid.trayFloorThicknessHint')
              : state.topThicknessEffective > state.topThicknessMm
                ? t('binDesigner.lid.topThicknessRaisedHint', {
                    thickness: state.topThicknessEffective.toFixed(1),
                  })
                : t('binDesigner.lid.topThicknessHint')}
          </Hint>
        </div>

        {state.isHinge && (
          <div className="space-y-1">
            <StepperField
              label={t('binDesigner.lid.hinge.fitClearance')}
              unit="mm"
              value={state.hinge.fitClearanceMm}
              onChange={handlers.setHingeFit}
              onStep={(delta) =>
                handlers.setHingeFit(state.hinge.fitClearanceMm + delta * state.hingeFitStep)
              }
              min={state.hingeFitMin}
              max={state.hingeFitMax}
              step={state.hingeFitStep}
              size="md"
              aria-label={t('binDesigner.lid.hinge.fitClearanceAria')}
              commitMode="deferred"
            />
            <Hint>{t('binDesigner.lid.hinge.fitClearanceHint')}</Hint>
          </div>
        )}

        {state.isSlide && (
          <div className="space-y-1">
            <StepperField
              label={t('binDesigner.lid.slide.clearance')}
              unit="mm"
              value={state.slide.clearanceMm}
              onChange={handlers.setSlideClearance}
              onStep={(delta) =>
                handlers.setSlideClearance(
                  state.slide.clearanceMm + delta * state.slideClearanceStep
                )
              }
              min={state.slideClearanceMin}
              max={state.slideClearanceMax}
              step={state.slideClearanceStep}
              size="md"
              aria-label={t('binDesigner.lid.slide.clearanceAria')}
              commitMode="deferred"
            />
            <Hint>{t('binDesigner.lid.slide.clearanceHint')}</Hint>
          </div>
        )}

        {showMagnetAdvanced && (
          <div className="space-y-2">
            <StepperField
              label={t('binDesigner.lid.retentionMagnetDiameter')}
              unit="mm"
              value={state.retentionMagnetDiameter}
              onChange={handlers.setRetentionMagnetDiameter}
              onStep={(delta) =>
                handlers.setRetentionMagnetDiameter(
                  state.retentionMagnetDiameter + delta * state.retentionMagnetStep
                )
              }
              min={state.retentionMagnetDiameterMin}
              max={state.retentionMagnetDiameterMax}
              step={state.retentionMagnetStep}
              size="md"
              aria-label={t('binDesigner.lid.retentionMagnetDiameterAria')}
              commitMode="deferred"
            />
            <StepperField
              label={t('binDesigner.lid.retentionMagnetDepth')}
              unit="mm"
              value={state.retentionMagnetDepth}
              onChange={handlers.setRetentionMagnetDepth}
              onStep={(delta) =>
                handlers.setRetentionMagnetDepth(
                  state.retentionMagnetDepth + delta * state.retentionMagnetStep
                )
              }
              min={state.retentionMagnetDepthMin}
              max={state.retentionMagnetDepthMax}
              step={state.retentionMagnetStep}
              size="md"
              aria-label={t('binDesigner.lid.retentionMagnetDepthAria')}
              commitMode="deferred"
            />
            <div className="space-y-1">
              <StepperField
                label={t('binDesigner.lid.retentionEdgeMagnets')}
                value={state.retentionMagnetEdgeMagnets}
                onChange={handlers.setRetentionMagnetEdgeMagnets}
                onStep={(delta) =>
                  handlers.setRetentionMagnetEdgeMagnets(
                    state.retentionMagnetEdgeMagnets + delta * state.retentionMagnetEdgeStep
                  )
                }
                min={state.retentionMagnetEdgeMin}
                max={state.retentionMagnetEdgeMax}
                step={state.retentionMagnetEdgeStep}
                size="md"
                aria-label={t('binDesigner.lid.retentionEdgeMagnetsAria')}
                commitMode="deferred"
              />
              <Hint>{t('binDesigner.lid.retentionEdgeMagnetsHint')}</Hint>
            </div>
          </div>
        )}

        {showCoverageAdvanced && (
          <div className="space-y-1">
            <SnappingSlider
              label={t('binDesigner.lid.clickRailCoverage')}
              value={state.clickRailCoverage}
              onChange={handlers.setClickRailCoverage}
              options={state.railCoverageOptions}
              unit="%"
            />
            <Readout>{state.railsReadout}</Readout>
          </div>
        )}

        <div className="space-y-1">
          <FeatureToggle
            label={t('binDesigner.lid.relieveInterior')}
            checked={state.relieveInterior}
            onChange={handlers.toggleRelieveInterior}
          />
          <Hint>
            {state.relieveInterior
              ? t('binDesigner.lid.relieveInteriorHint')
              : t('binDesigner.lid.relieveInteriorOffHint')}
          </Hint>
        </div>

        {showTrayAdvanced && (
          <div className="space-y-2">
            <StepperField
              label={t('binDesigner.lid.trayDepth')}
              unit="mm"
              value={state.tray.depthMm}
              onChange={handlers.setTrayDepth}
              onStep={(delta) => handlers.setTrayDepth(state.tray.depthMm + delta * state.trayStep)}
              min={state.trayDepthMin}
              max={state.trayDepthMax}
              step={state.trayStep}
              size="md"
              aria-label={t('binDesigner.lid.trayDepthAria')}
              commitMode="deferred"
            />
            <StepperField
              label={t('binDesigner.lid.trayWall')}
              unit="mm"
              value={state.tray.wallMm}
              onChange={handlers.setTrayWall}
              onStep={(delta) => handlers.setTrayWall(state.tray.wallMm + delta * state.trayStep)}
              min={state.trayWallMin}
              max={state.trayWallMax}
              step={state.trayStep}
              size="md"
              aria-label={t('binDesigner.lid.trayWallAria')}
              commitMode="deferred"
            />
          </div>
        )}
      </div>
    </Collapsible>
  );
}
