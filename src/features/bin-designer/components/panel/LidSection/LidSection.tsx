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
 * nothing, so `topThicknessMm` is a user knob (#2761).
 */

import { useState } from 'react';
import { Button, SegmentedControl, Collapsible } from '@/design-system';
import { Switch } from '@/design-system/Switch';
import { RulerIcon } from '@/design-system/Icon';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { StepperField } from '../shared/StepperField';
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

/** Uppercase subsection label separating the lid's mental-model groups. */
function SubHeader({ children }: { children: string }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
      {children}
    </span>
  );
}

/** Small tertiary hint paragraph reused across the section. */
function Hint({ children }: { children: string }) {
  return <p className="text-[11px] leading-relaxed text-content-tertiary">{children}</p>;
}

/** Read-out row (ruler icon + tabular text). */
function Readout({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
      <RulerIcon size="xs" />
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

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
    <li className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${textColor}`}>
      <span className={`mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full ${dotColor}`} />
      <span className="flex-1">{message}</span>
      {fixable && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onFix(issue.id)}
          aria-label={t('binDesigner.lid.compat.fixAriaLabel', { detail: message })}
          className="shrink-0 rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-content-secondary hover:bg-surface-hover"
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
  const showTrayAdvanced = state.topSurface === 'tray';

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
              <p className="text-[11px] font-medium text-content-secondary">
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
          </section>

          {/* ── Top surface ──────────────────────────────────────────── */}
          <section className="space-y-2">
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
                    </>
                  )}
                </>
              }
            />
          </section>

          {/* ── Extra height (folded in) ─────────────────────────────── */}
          <div className="space-y-1">
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
                  label={t('binDesigner.lid.topThickness')}
                  unit="mm"
                  value={state.topThicknessMm}
                  onChange={handlers.setTopThickness}
                  onStep={(delta) =>
                    handlers.setTopThickness(state.topThicknessMm + delta * state.topThicknessStep)
                  }
                  min={state.topThicknessMin}
                  max={state.topThicknessMax}
                  step={state.topThicknessStep}
                  size="md"
                  aria-label={t('binDesigner.lid.topThicknessAria')}
                  commitMode="deferred"
                />
                <Hint>
                  {state.topThicknessEffective > state.topThicknessMm
                    ? t('binDesigner.lid.topThicknessRaisedHint', {
                        thickness: state.topThicknessEffective.toFixed(1),
                      })
                    : t('binDesigner.lid.topThicknessHint')}
                </Hint>
              </div>

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
        </>
      )}
    </div>
  );
}
