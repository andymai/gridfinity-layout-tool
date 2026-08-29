/**
 * Lid section — top-level "Lid" group body.
 *
 * Organized around three ideas so the ~dozen knobs read as intent, not a
 * flat wall of controls:
 *   1. How it attaches — friction / click rails / magnetic (+ mode controls)
 *   2. Top surface     — flat / stackable / tray (+ its sub-options)
 *   3. Extra height     — deepen the cavity for tall contents
 * Millimetre fine-tuning (plate thickness, magnet size, rail coverage, tray
 * dimensions) lives under a collapsed "Advanced" disclosure so the default
 * view stays scannable.
 *
 * Wall thickness and fit clearance are intentionally NOT exposed: the
 * click-lock geometry only works with one validated numeric set (see
 * `lidConstants.ts`). The floor plate is the exception — it mates with
 * nothing, so `topThicknessMm` is a user knob.
 */

import { useState } from 'react';
import { Button, SegmentedControl, Collapsible } from '@/design-system';
import { Switch } from '@/design-system/Switch';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { LidGripControls } from '../LidGripControls';
import { SlideControls } from '../SlideControls';
import { HingeControls } from '../HingeControls';
import { StepperField } from '../shared/StepperField';
import { Hint, Readout, SubHeader, DependencyHint } from '../shared';
import type {
  LidCompatibilityId,
  LidCompatibilityIssue,
} from '@/features/bin-designer/utils/lidCompatibility';
import { LID_RAIL_SIDES, LID_ATTACHMENTS } from '@/features/bin-designer/types';
import type { TextMode } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { CompartmentTextInput } from '../LabelTabsSection/CompartmentTextInput';
import { FeatureToggle } from '../FeatureToggle';
import { useLidSection, LID_TOP_SURFACES } from './useLidSection';

/** Mode options for the lid-text picker, in the shared textMode order. */
const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'] as const;

type Translator = ReturnType<typeof useTranslation>;

/** Render a single compatibility issue as a colored bullet line with an
 *  optional one-click Fix button. The button is only shown for issues
 *  whose ID appears in `fixableIds` — issues like `shortBin` or
 *  `cellMaskHoles` need user judgment and don't get an automatic fix. */
function CompatibilityIssue({
  issue,
  fixable,
  onFix,
  t,
}: {
  issue: LidCompatibilityIssue;
  fixable: boolean;
  onFix: (id: LidCompatibilityId) => void;
  t: Translator;
}) {
  // Side IDs ('front'/'back'/'left'/'right') are internal — translate
  // each through `binDesigner.lid.side.*` before joining so non-English
  // locales don't render raw English tokens in the warning text.
  const sides = issue.sides
    ? issue.sides.map((s) => t(`binDesigner.lid.side.${s}`)).join(', ')
    : '';
  const message = t(`binDesigner.lid.compat.${issue.id}`, { sides });
  // Blockers are rendered with the danger token (red); warnings are
  // amber. Both use a small filled dot so the row reads as a list
  // item rather than body copy.
  const isBlocker = issue.severity === 'blocker';
  const dotColor = isBlocker ? 'bg-danger' : 'bg-warning';
  const textColor = isBlocker ? 'text-danger' : 'text-warning';
  return (
    <li className={`flex items-start gap-1.5 text-label leading-relaxed ${textColor}`}>
      <span className={`mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full ${dotColor}`} />
      <span className="flex-1">{message}</span>
      {fixable && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onFix(issue.id)}
          aria-label={t('binDesigner.lid.compat.fixAriaLabel', { detail: message })}
          className="shrink-0 rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-micro font-medium text-content-secondary hover:bg-surface-hover"
        >
          {t('binDesigner.lid.compat.fixButton')}
        </Button>
      )}
    </li>
  );
}

/** Per-side click-rail toggles. Multi-select (each wall independent), so this
 *  stays a hand-rolled switch group rather than the single-select
 *  SegmentedControl primitive. A side auto-disables when a feature conflict
 *  (label tab, wall cutout, intruding handle) affects it; the user's persisted
 *  intent is kept so the rail returns once the conflict is resolved. */
function RailSides({
  state,
  onToggle,
  t,
}: {
  state: ReturnType<typeof useLidSection>['state'];
  onToggle: (side: (typeof LID_RAIL_SIDES)[number]) => void;
  t: Translator;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-content-secondary">
        {t('binDesigner.lid.clickRails')}
      </span>
      <div className="flex gap-1">
        {LID_RAIL_SIDES.map((side) => {
          const isActive = state.clickRails[side];
          const isAutoDisabled = state.disabledRails.has(side);
          const effectiveActive = isActive && !isAutoDisabled;
          const tooltip = isAutoDisabled
            ? t('binDesigner.lid.clickRailDisabledBySide', {
                side: t(`binDesigner.lid.side.${side}`),
              })
            : undefined;
          return (
            <Button
              key={side}
              type="button"
              variant="ghost"
              role="switch"
              aria-checked={effectiveActive}
              aria-disabled={isAutoDisabled}
              disabled={isAutoDisabled}
              title={tooltip}
              onClick={() => onToggle(side)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                isAutoDisabled
                  ? 'cursor-not-allowed border border-stroke-subtle bg-surface-secondary text-content-tertiary line-through opacity-60'
                  : effectiveActive
                    ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.lid.side.${side}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function LidSection() {
  const { state, handlers, t } = useLidSection();
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
    <div className="space-y-4">
      {/* Master enable. Disabled (with a reason) when the bin has no stacking
          lip or a blocker-severity feature conflict is unresolved. */}
      <FeatureToggle
        label={t('binDesigner.lid.enable')}
        checked={state.enabled}
        onChange={handlers.toggleEnabled}
        disabledReason={state.disabledReason}
      />
      {state.stackingLipMissing && (
        <DependencyHint
          actionLabel={t('binDesigner.dependency.enableStackingLip')}
          onAction={handlers.enableStackingLip}
        />
      )}

      {state.enabled && (
        <>
          {/* Print-time hint — the mating cavity and click rails are
              downward-facing overhangs that need supports for a clean print. */}
          <Hint>{t('binDesigner.lid.printNote')}</Hint>

          {/* Compatibility notes — features that conflict with click-lock
              mating. Only renders when there are issues; blockers and warnings
              share the list and are color-coded by severity. */}
          {state.compatibilityIssues.length > 0 && (
            <div className="space-y-1 rounded-md border border-stroke-subtle bg-surface-secondary px-2.5 py-2">
              <p className="text-label font-medium text-content-secondary">
                {t('binDesigner.lid.compat.heading')}
              </p>
              <ul className="space-y-1">
                {state.compatibilityIssues.map((issue) => (
                  <CompatibilityIssue
                    key={issue.id}
                    issue={issue}
                    fixable={state.fixableIds.has(issue.id)}
                    onFix={handlers.fixIssue}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Live physical readout — grounds the params in real-world mm. */}
          <Readout>{state.dimensionsReadout}</Readout>

          {/* ── How it attaches ──────────────────────────────────────── */}
          <section className="space-y-2">
            <SubHeader>{t('binDesigner.lid.section.attaches')}</SubHeader>
            <SegmentedControl
              aria-label={t('binDesigner.lid.attachment')}
              activeStyle="accent"
              fullWidth
              size="sm"
              value={state.attachment}
              onChange={handlers.setAttachment}
              options={LID_ATTACHMENTS.map((mode) => ({
                value: mode,
                label: t(`binDesigner.lid.attachment.${mode}`),
              }))}
            />

            {state.attachment === 'friction' && <Hint>{t('binDesigner.lid.frictionHint')}</Hint>}

            {state.attachment === 'magnetic' && (
              <>
                <Hint>
                  {t('binDesigner.lid.retentionMagnetHint', {
                    diameter: state.retentionMagnetDiameter.toFixed(1),
                    depth: state.retentionMagnetDepth.toFixed(1),
                  })}
                </Hint>
                {state.hasMagneticRelief && (
                  <Hint>
                    {t('binDesigner.lid.magneticClearanceHint', {
                      clearance: state.magneticClearanceMm.toFixed(2),
                    })}
                  </Hint>
                )}
              </>
            )}

            {state.attachment === 'clickRails' && (
              <RailSides state={state} onToggle={handlers.toggleClickRailSide} t={t} />
            )}

            {state.isSlide && <SlideControls state={state} handlers={handlers} t={t} />}

            {state.isHinge && <HingeControls state={state} handlers={handlers} t={t} />}
          </section>

          {/* ── Top surface ──────────────────────────────────────────── */}
          <section className={`space-y-2 ${state.isSlide ? 'hidden' : ''}`}>
            <SubHeader>{t('binDesigner.lid.section.topSurface')}</SubHeader>
            <SegmentedControl
              aria-label={t('binDesigner.lid.section.topSurface')}
              activeStyle="accent"
              fullWidth
              size="sm"
              value={state.topSurface}
              onChange={handlers.setTopSurface}
              options={LID_TOP_SURFACES.map((mode) => ({
                value: mode,
                label: t(`binDesigner.lid.topSurface.${mode}`),
              }))}
            />

            {state.topSurface === 'flat' && <Hint>{t('binDesigner.lid.topSurface.flatHint')}</Hint>}

            {state.topSurface === 'stackable' && (
              <div className="space-y-2">
                <Switch
                  label={t('binDesigner.lid.stackLipOnly')}
                  checked={state.stackLipOnly}
                  onChange={handlers.toggleStackLipOnly}
                />
                <Hint>
                  {state.stackLipOnly
                    ? t('binDesigner.lid.stackLipOnlyHint')
                    : t('binDesigner.lid.stackGridHint')}
                </Hint>
                {state.stackLipOnlyIsNoOp && <Hint>{t('binDesigner.lid.stackLipOnlyNoOp')}</Hint>}
                {state.stackLipOnlyNeedsPlateHint && (
                  <Hint>{t('binDesigner.lid.stackLipOnlyPrintNote')}</Hint>
                )}
                <Switch
                  label={t('binDesigner.lid.magnetHoles')}
                  checked={state.magnetHoles}
                  onChange={handlers.toggleMagnetHoles}
                />
                {state.magnetHoles && (
                  <Hint>
                    {t('binDesigner.lid.magnetSpec', {
                      diameter: state.magnetDiameter.toFixed(1),
                      depth: state.magnetDepth.toFixed(1),
                    })}
                  </Hint>
                )}
                <Switch
                  label={t('binDesigner.lid.separateStackPlate')}
                  checked={state.separateStackPlate}
                  onChange={handlers.toggleSeparateStackPlate}
                />
                {state.separateStackPlate && (
                  <Hint>{t('binDesigner.lid.separateStackPlateHint')}</Hint>
                )}
              </div>
            )}
          </section>

          {/* ── Lid text (#2695) — gated behind a toggle to match wall text. */}
          <section className="space-y-2">
            <FeatureToggle
              label={t('binDesigner.lid.section.text')}
              checked={state.isLidTextOpen}
              onChange={handlers.toggleLidText}
              disabledReason={state.textDisabledReason}
              primaryControls={
                <>
                  {/* Deferred-commit input shared with compartment labels so
                      typing doesn't regenerate the lid per keystroke; the id
                      slot is unused for the lid. */}
                  <CompartmentTextInput
                    multiline
                    committedValue={state.lidText}
                    compartmentId={0}
                    placeholder={t('binDesigner.lid.text.placeholder')}
                    ariaLabel={t('binDesigner.lid.text.aria')}
                    onCommit={handlers.commitLidText}
                  />
                  {state.lidText.trim() !== '' && (
                    <>
                      <SegmentedControl
                        aria-label={t('binDesigner.textMode')}
                        activeStyle="accent"
                        fullWidth
                        size="sm"
                        value={state.textMode}
                        onChange={handlers.setTextMode}
                        options={TEXT_MODE_OPTIONS.map((mode) => ({
                          value: mode,
                          label: t(`binDesigner.textMode.${mode}`),
                        }))}
                      />
                      {state.textMode === 'through-cut' && (
                        <Hint>{t('binDesigner.textMode.throughCutStencilNote')}</Hint>
                      )}
                      {state.textOnTrayFloor && <Hint>{t('binDesigner.lid.text.trayHint')}</Hint>}
                      {state.textOnStackLipFloor && (
                        <Hint>{t('binDesigner.lid.text.stackLipHint')}</Hint>
                      )}
                      {state.textEmbossBlocksStacking && (
                        <Hint>{t('binDesigner.lid.text.stackLipEmbossWarning')}</Hint>
                      )}
                    </>
                  )}
                </>
              }
            />
          </section>

          {/* ── Holes through the plate ───────────────────────────────── */}
          <div className="space-y-1">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!state.cutouts.allowed}
              onClick={handlers.openLidCutoutEditor}
            >
              {state.cutouts.count > 0
                ? t('binDesigner.lid.editCutoutsCount', { count: state.cutouts.count })
                : t('binDesigner.lid.editCutouts')}
            </Button>
            <Hint>
              {!state.cutouts.allowed
                ? t('binDesigner.lid.editCutoutsBlocked')
                : state.cutouts.atCapacity
                  ? t('binDesigner.lid.editCutoutsFull', { max: state.cutouts.max })
                  : t('binDesigner.lid.editCutoutsHint')}
            </Hint>
          </div>

          {/* ── Extra height (folded in) ─────────────────────────────── */}
          <div className={`space-y-1 ${state.isSlide ? 'hidden' : ''}`}>
            <StepperField
              label={t('binDesigner.lid.extraHeight')}
              unit="mm"
              value={state.extraHeightMm}
              onChange={handlers.setExtraHeight}
              onStep={(delta) =>
                handlers.setExtraHeight(state.extraHeightMm + delta * state.extraHeightStep)
              }
              min={state.extraHeightMin}
              max={state.extraHeightMax}
              step={state.extraHeightStep}
              size="md"
              aria-label={t('binDesigner.lid.extraHeightAria')}
              commitMode="deferred"
            />
            <Hint>{t('binDesigner.lid.extraHeightHint')}</Hint>
          </div>

          {/* ── Advanced (millimetre fine-tuning) ────────────────────── */}
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
                      <dd className="tabular-nums">
                        {state.trayBreakdown.overallMm.toFixed(1)} mm
                      </dd>
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
                <Switch
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
                    onStep={(delta) =>
                      handlers.setTrayDepth(state.tray.depthMm + delta * state.trayStep)
                    }
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
                    onStep={(delta) =>
                      handlers.setTrayWall(state.tray.wallMm + delta * state.trayStep)
                    }
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

          <section
            data-help-target="bd-lid-grip"
            className={`space-y-2 border-t border-stroke-subtle pt-3 ${
              state.isSlide ? 'hidden' : ''
            }`}
          >
            <SubHeader>{t('binDesigner.lid.section.grip')}</SubHeader>
            <p className="text-xs text-content-tertiary">{t('binDesigner.lid.gripHint')}</p>
            <LidGripControls state={state} handlers={handlers} t={t} />
          </section>

          {/* Hands off to a NEW design (#3036) — see `matchingTrayParams`. */}
          <section className="space-y-2 border-t border-stroke-subtle pt-3">
            <SubHeader>{t('binDesigner.lid.section.tray')}</SubHeader>
            <p className="text-xs text-content-tertiary">{t('binDesigner.lid.matchingTrayHint')}</p>
            <Button variant="secondary" size="sm" onClick={handlers.createMatchingTray}>
              {t('binDesigner.lid.createMatchingTray')}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
