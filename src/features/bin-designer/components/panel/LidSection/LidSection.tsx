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

import { Button, SegmentedControl } from '@/design-system';
import { LidGripControls } from '../LidGripControls';
import { SlideControls } from '../SlideControls';
import { HingeControls } from '../HingeControls';
import {
  DependencyHint,
  FieldLabel,
  Hint,
  InfoDot,
  Readout,
  SegmentGrid,
  SideSelector,
  SubHeader,
  TextColorControl,
  TextFinishGrid,
} from '../shared';
import type { SideState } from '../shared';
import type { TextSurface } from '@/features/bin-designer/utils/flatTextContrast';
import {
  LID_ISSUES_WITHOUT_DETAIL,
  type LidCompatibilityId,
  type LidCompatibilityIssue,
} from '@/features/bin-designer/utils/lidCompatibility';
import { LID_RAIL_SIDES, LID_ATTACHMENTS } from '@/features/bin-designer/types';
import type { TextMode } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { CompartmentTextInput } from '../LabelTabsSection/CompartmentTextInput';
import { FeatureToggle } from '../FeatureToggle';
import { useLidSection, LID_TOP_SURFACES } from './useLidSection';
import { LidAdvancedFields } from './LidAdvancedFields';
import { LidHeightField } from './LidHeightField';
import { LidTextRotation } from './LidTextRotation';

/** Mode options for the lid-text picker, in the shared textMode order. */
const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'] as const;
const LID_SURFACE: readonly TextSurface[] = ['lid'];

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
      <p className="flex-1">
        {t(`binDesigner.lid.compat.${issue.id}`, { sides })}
        {!LID_ISSUES_WITHOUT_DETAIL.has(issue.id) && (
          <span className="ml-1 inline-flex align-middle">
            <InfoDot aria-label={t('binDesigner.infoButton')}>
              <p>{t(`binDesigner.lid.compat.${issue.id}Detail`, { sides })}</p>
            </InfoDot>
          </span>
        )}
      </p>
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

/** Per-side click-rail toggles. Multi-select (each wall independent). A side
 *  auto-disables when a feature conflict (label tab, wall cutout, intruding
 *  handle) affects it; the user's persisted intent is kept so the rail returns
 *  once the conflict is resolved. */
function RailSides({
  state,
  onToggle,
  t,
}: {
  state: ReturnType<typeof useLidSection>['state'];
  onToggle: (side: (typeof LID_RAIL_SIDES)[number]) => void;
  t: Translator;
}) {
  const sides: SideState[] = LID_RAIL_SIDES.map((side) => {
    const isAutoDisabled = state.disabledRails.has(side);
    return {
      side,
      label: t(`binDesigner.lid.side.${side}`),
      active: state.clickRails[side],
      disabled: isAutoDisabled,
      title: isAutoDisabled
        ? t('binDesigner.lid.clickRailDisabledBySide', {
            side: t(`binDesigner.lid.side.${side}`),
          })
        : undefined,
    };
  });
  return (
    <div>
      <FieldLabel>{t('binDesigner.lid.clickRails')}</FieldLabel>
      <SideSelector sides={sides} onToggle={onToggle} ariaLabel={t('binDesigner.lid.clickRails')} />
    </div>
  );
}

export function LidSection() {
  const { state, handlers, t } = useLidSection();

  return (
    <div className="space-y-4">
      {/* Master enable. Disabled (with a reason) when the bin has no stacking
          lip or a blocker-severity feature conflict is unresolved. */}
      <FeatureToggle
        label={t('binDesigner.lid.enable')}
        checked={state.enabled}
        onChange={handlers.toggleEnabled}
        disabledReason={state.disabledReason}
        badge={
          <InfoDot aria-label={t('binDesigner.infoButton')}>
            <p>{t('binDesigner.lid.printNote')}</p>
          </InfoDot>
        }
      />
      {state.stackingLipMissing && (
        <DependencyHint
          actionLabel={t('binDesigner.dependency.enableStackingLip')}
          onAction={handlers.enableStackingLip}
        />
      )}

      {/* Persisted flag, not the buildable gate: the fix for a hinge blocker
          lives in here. */}
      {state.enabled && (
        <>
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
            <SegmentGrid
              aria-label={t('binDesigner.lid.attachment')}
              value={state.attachment}
              onChange={handlers.setAttachment}
              options={LID_ATTACHMENTS.map((mode) => ({
                value: mode,
                label: t(`binDesigner.lid.attachment.${mode}`),
              }))}
            />

            {state.attachment === 'friction' && <Hint>{t('binDesigner.lid.frictionHint')}</Hint>}

            {state.attachment === 'magnetic' && (
              <Hint
                info={
                  <div className="space-y-2">
                    <p>{t('binDesigner.lid.retentionMagnetHintDetail')}</p>
                    {state.hasMagneticRelief && (
                      <p>
                        {t('binDesigner.lid.magneticClearanceHint', {
                          clearance: state.magneticClearanceMm.toFixed(2),
                        })}
                      </p>
                    )}
                  </div>
                }
              >
                {t('binDesigner.lid.retentionMagnetHint', {
                  diameter: state.retentionMagnetDiameter.toFixed(1),
                  depth: state.retentionMagnetDepth.toFixed(1),
                })}
              </Hint>
            )}

            {state.fillAvailable && (
              <FeatureToggle
                label={t('binDesigner.lid.fill')}
                checked={state.fill}
                onChange={handlers.toggleFill}
                info={t('binDesigner.lid.fillHint')}
              />
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
                <FeatureToggle
                  label={t('binDesigner.lid.stackLipOnly')}
                  checked={state.stackLipOnly}
                  onChange={handlers.toggleStackLipOnly}
                  info={t('binDesigner.lid.stackLipOnlyHint')}
                />
                {!state.stackLipOnly && <Hint>{t('binDesigner.lid.stackGridHint')}</Hint>}
                {state.stackLipOnlyIsNoOp && <Hint>{t('binDesigner.lid.stackLipOnlyNoOp')}</Hint>}
                {state.stackLipOnlyNeedsPlateHint && (
                  <Hint info={t('binDesigner.lid.stackLipOnlyPrintNoteDetail')}>
                    {t('binDesigner.lid.stackLipOnlyPrintNote')}
                  </Hint>
                )}
                <FeatureToggle
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
                <FeatureToggle
                  label={t('binDesigner.lid.separateStackPlate')}
                  checked={state.separateStackPlate}
                  onChange={handlers.toggleSeparateStackPlate}
                  info={t('binDesigner.lid.separateStackPlateHint')}
                />
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
                      <TextFinishGrid
                        modes={TEXT_MODE_OPTIONS}
                        value={state.textMode}
                        onChange={handlers.setTextMode}
                      />
                      {state.textMode === 'through-cut' && (
                        <Hint>{t('binDesigner.textMode.throughCutStencilNote')}</Hint>
                      )}
                      <LidTextRotation />
                      <TextColorControl surfaces={LID_SURFACE} flat={state.textMode === 'flat'} />
                      {state.textOnTrayFloor && <Hint>{t('binDesigner.lid.text.trayHint')}</Hint>}
                      {state.textOnStackLipFloor && (
                        <Hint>{t('binDesigner.lid.text.stackLipHint')}</Hint>
                      )}
                      {state.textEmbossBlocksStacking && (
                        <Hint info={t('binDesigner.lid.text.stackLipEmbossWarningDetail')}>
                          {t('binDesigner.lid.text.stackLipEmbossWarning')}
                        </Hint>
                      )}
                    </>
                  )}
                </>
              }
            />
            {state.textDisabledByStackGrid && (
              <DependencyHint
                actionLabel={t('binDesigner.lid.text.useStackLipOnly')}
                onAction={handlers.toggleStackLipOnly}
              />
            )}
          </section>

          {/* ── Holes through the plate ───────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="w-full flex-1"
                disabled={!state.cutouts.allowed}
                onClick={handlers.openLidCutoutEditor}
              >
                {state.cutouts.count > 0
                  ? t('binDesigner.lid.editCutoutsCount', { count: state.cutouts.count })
                  : t('binDesigner.lid.editCutouts')}
              </Button>
              <InfoDot aria-label={t('binDesigner.infoButton')}>
                <p>{t('binDesigner.lid.editCutoutsHint')}</p>
              </InfoDot>
            </div>
            {!state.cutouts.allowed && (
              <Hint info={t('binDesigner.lid.editCutoutsBlockedDetail')}>
                {t('binDesigner.lid.editCutoutsBlocked')}
              </Hint>
            )}
            {state.cutouts.allowed && state.cutouts.atCapacity && (
              <Hint>{t('binDesigner.lid.editCutoutsFull', { max: state.cutouts.max })}</Hint>
            )}
          </div>

          <div className={state.isSlide ? 'hidden' : ''}>
            <LidHeightField />
          </div>

          {/* ── Advanced (millimetre fine-tuning) ────────────────────── */}
          <LidAdvancedFields state={state} handlers={handlers} t={t} />

          <section
            data-help-target="bd-lid-grip"
            className={`space-y-2 border-t border-stroke-subtle pt-3 ${
              state.isSlide ? 'hidden' : ''
            }`}
          >
            <SubHeader info={t('binDesigner.lid.gripHint')}>
              {t('binDesigner.lid.section.grip')}
            </SubHeader>
            <LidGripControls state={state} handlers={handlers} t={t} />
          </section>

          {/* Hands off to a NEW design (#3036) — see `matchingTrayParams`. */}
          <section className="space-y-2 border-t border-stroke-subtle pt-3">
            <SubHeader info={t('binDesigner.lid.matchingTrayHint')}>
              {t('binDesigner.lid.section.tray')}
            </SubHeader>
            <Button variant="secondary" size="sm" onClick={handlers.createMatchingTray}>
              {t('binDesigner.lid.createMatchingTray')}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
