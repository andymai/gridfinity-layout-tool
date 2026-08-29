/**
 * Base section: the underside of the bin and how it mates with everything else.
 *
 * Organised as one exclusive choice followed by the families of settings that
 * choice admits:
 *   1. Body type: feet, floor and walls, or some of them (`BodyTypeCards`)
 *   2. Stacking:  the lip, which is the base's mating partner one bin up
 *   3. Mounting:  magnet and screw pockets
 *   4. Feet:      how the feet are laid out under the bin
 *   5. Floor:     what is removed from the floor
 *
 * Subsections 3-5 drop their controls where the chosen body has no use for
 * them: a spacer has no floor to perforate, a flat base has no socket to drill
 * or lighten. Each keeps its heading and one line saying why, so a control is
 * never simply absent between one body type and the next. Nothing that is still
 * in force is hidden either. The constraint engine CLEARS what it disables, so
 * a dropped row is always a row that is off.
 *
 * Disabled reasons are computed by the constraint engine via useBaseSection.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { Button, SegmentedControl, SliderInput } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { Hint, SubHeader } from '../shared';
import {
  DEFAULT_FOOT_LATTICE,
  FOOT_LATTICES,
  LID_ATTACHMENTS,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_RAIL_SIDES,
  LIGHTWEIGHT_MODES,
  DETACHABLE_PIN_DIAMETERS_MM,
} from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { MoreDisclosure } from '@/shared/components/MoreDisclosure';
import { BodyTypeCards } from './BodyTypeCards';
import { useBaseSection } from './useBaseSection';

/** Axis key suffixes for the foot-lattice translation keys. */
const FOOT_LATTICE_AXES = ['x', 'y'] as const;

/**
 * A family the chosen body cannot have, named rather than removed.
 *
 * Dropping the heading with the controls made a control vanish between one body
 * type and the next with nothing said, which is worse than the greyed row it
 * replaced: the setting was cleared either way, but the user lost the sentence
 * explaining it. Keeping one dimmed line costs a row per inapplicable family
 * and leaves nothing unaccounted for.
 */
export function UnavailableFamily({ title, reason }: { title: string; reason: string }) {
  return (
    <section className="space-y-1 opacity-60">
      <SubHeader>{title}</SubHeader>
      <Hint>{reason}</Hint>
    </section>
  );
}

export function BaseSection() {
  const { state, handlers } = useBaseSection();
  const t = useTranslation();

  const footLatticeAxes = [
    {
      axis: FOOT_LATTICE_AXES[0],
      value: state.footLatticeX,
      onChange: handlers.setFootLatticeX,
      locked: state.footLatticeLockedX,
    },
    {
      axis: FOOT_LATTICE_AXES[1],
      value: state.footLatticeY,
      onChange: handlers.setFootLatticeY,
      locked: state.footLatticeLockedY,
    },
  ];

  /* The tray body type's mating controls. They reuse the lid section's copy
     deliberately: it is the same joint seen from the other side. */
  const trayOptions = (
    <div className="space-y-3">
      <Hint>{t('binDesigner.lidBottom.hint')}</Hint>

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
  );

  return (
    <div className="space-y-5">
      {/* ── Body type ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SubHeader>{t('binDesigner.base.bodyType')}</SubHeader>
        <BodyTypeCards
          value={state.bodyType}
          onChange={handlers.setBodyType}
          options={{
            spacer: <Hint>{t('binDesigner.spacerHint')}</Hint>,
            tile: <Hint>{t('binDesigner.tileHint')}</Hint>,
            tray: trayOptions,
          }}
        />
      </section>

      {/* ── Stacking ──────────────────────────────────────────────────
          The lip is the base's mating partner one bin up: it is what the NEXT
          bin's feet drop into, which is why it is filed here rather than with
          the walls it sits on. */}
      <section className="space-y-2">
        <SubHeader>{t('binDesigner.base.section.stacking')}</SubHeader>
        {/* Shares the assembled-height breakdown's noun (the same lip, named
            once) rather than duplicating the string across every locale. */}
        <FeatureToggle
          label={t('assembledHeight.stackingLip')}
          checked={state.base.stackingLip}
          onChange={handlers.toggleStackingLip}
        />
        <Hint>{t('binDesigner.base.stackingLip.hint')}</Hint>
      </section>

      {/* ── Mounting ──────────────────────────────────────────────────── */}
      {!state.showMounting && state.mountingUnavailable && (
        <UnavailableFamily
          title={t('binDesigner.base.section.mounting')}
          reason={state.mountingUnavailable}
        />
      )}
      {state.showMounting && (
        <section className="space-y-3">
          <SubHeader>{t('binDesigner.base.section.mounting')}</SubHeader>

          <FeatureToggle
            label={t('binDesigner.base.magnetHoles')}
            checked={state.hasMagnet}
            onChange={handlers.toggleMagnet}
            disabledReason={handlers.magnetDisabledReason}
            valueSummary={t('binDesigner.base.magnetSummary', {
              diameter: state.base.magnetDiameter,
              depth: state.base.magnetDepth,
            })}
          >
            <SliderInput
              label={t('binDesigner.base.magnetDiameter')}
              value={state.base.magnetDiameter}
              onChange={handlers.setMagnetDiameter}
              min={DESIGNER_CONSTRAINTS.MIN_MAGNET_DIAMETER}
              max={DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER}
              step={DESIGNER_CONSTRAINTS.MAGNET_DIAMETER_STEP}
              unit="mm"
            />
            <SliderInput
              label={t('binDesigner.base.magnetDepth')}
              value={state.base.magnetDepth}
              onChange={handlers.setMagnetHeight}
              min={DESIGNER_CONSTRAINTS.MIN_MAGNET_HEIGHT}
              max={DESIGNER_CONSTRAINTS.MAX_MAGNET_HEIGHT}
              step={DESIGNER_CONSTRAINTS.MAGNET_HEIGHT_STEP}
              unit="mm"
            />
          </FeatureToggle>

          <FeatureToggle
            label={t('binDesigner.base.screwHoles')}
            checked={state.hasScrew}
            onChange={handlers.toggleScrew}
            disabledReason={handlers.screwDisabledReason}
            valueSummary={`\u00f8${state.base.screwDiameter}mm`}
          >
            <SliderInput
              label={t('binDesigner.base.screwDiameter')}
              value={state.base.screwDiameter}
              onChange={handlers.setScrewDiameter}
              min={DESIGNER_CONSTRAINTS.MIN_SCREW_DIAMETER}
              max={DESIGNER_CONSTRAINTS.MAX_SCREW_DIAMETER}
              step={DESIGNER_CONSTRAINTS.SCREW_DIAMETER_STEP}
              unit="mm"
            />
          </FeatureToggle>
        </section>
      )}

      {/* ── Feet ──────────────────────────────────────────────────────── */}
      {!state.showFeet && state.feetUnavailable && (
        <UnavailableFamily
          title={t('binDesigner.base.section.feet')}
          reason={state.feetUnavailable}
        />
      )}
      {state.showFeet && (
        <section className="space-y-3">
          <SubHeader>{t('binDesigner.base.section.feet')}</SubHeader>

          {/* Heads the foot cluster. Half sockets and the lightweight modes
              below describe INTEGRAL feet, which this mode answers its own way
              — they are locked rather than cleared, so the reason sits under
              the thing that caused it and the setting survives a round trip
              through the toggle. The foot LATTICE stays live: the detachable
              plan consumes it, and the half lattice is the only layout that
              seats a half-offset detachable bin. */}
          <FeatureToggle
            label={t('binDesigner.detachableFeet')}
            checked={state.hasDetachableFeet}
            onChange={handlers.toggleDetachableFeet}
            disabledReason={handlers.detachableFeetDisabledReason}
            valueSummary={t('binDesigner.detachableFeet.summary', {
              count: state.detachableFootCount,
              diameter: state.pinDiameter,
            })}
            primaryControls={
              <Hint>
                {state.detachableUnplaceable
                  ? t('binDesigner.detachableFeet.unplaceable')
                  : state.detachableSavingPercent > 0
                    ? t('binDesigner.detachableFeet.saving', {
                        percent: state.detachableSavingPercent,
                      })
                    : /* The counterfactual bin keeps its stored lightweight
                         saving while the detachable one supersedes it, so the
                         delta can go negative — a true number the "uses less
                         material" copy would misstate. */
                      t('binDesigner.detachableFeet.savingSuperseded')}
              </Hint>
            }
          >
            <SegmentedControl
              aria-label={t('binDesigner.detachableFeet.pinSize')}
              activeStyle="accent"
              fullWidth
              size="sm"
              value={String(state.pinDiameter)}
              onChange={(value) => handlers.setPinDiameter(Number(value))}
              options={DETACHABLE_PIN_DIAMETERS_MM.map((diameter) => ({
                value: String(diameter),
                label: `\u00f8${diameter}mm`,
              }))}
            />
            <Hint>{t('binDesigner.detachableFeet.pinHint')}</Hint>
          </FeatureToggle>

          <FeatureToggle
            label={t('binDesigner.halfSockets')}
            checked={state.hasHalfSockets}
            onChange={handlers.toggleHalfSockets}
            disabledReason={handlers.halfSocketsDisabledReason}
          />

          {/* Why the lattice below is missing, in the slot it would occupy. The
              control that caused it is usually the toggle directly above, so
              this still reads as an explanation at its cause. */}
          {state.footLatticeInertReason && <Hint>{state.footLatticeInertReason}</Hint>}

          {/* Foot lattice (#3467). A foot has to land inside one baseplate
              pocket, so which layout seats depends on where the bin sits, per
              axis, since half-bin mode can offset one axis and not the other.

              Folded away because it is a power-user setting that is at its
              default on nearly every bin, and it was the heaviest block in this
              section. `forceOpen` on a non-default value is what makes that
              safe: a wrong lattice leaves the bin perched on the ridges between
              pockets, so the one state that must never be hidden is the one
              that differs. The summary reports the EFFECTIVE lattice, which is
              what gets built. A stored value the lock overrides reads as the
              default it is being honoured as, not as the customization it is
              not. */}
          {state.showFootLattice && (
            <MoreDisclosure
              label={`${t('binDesigner.footLattice')}:`}
              summary={
                state.footLatticeX === state.footLatticeY
                  ? t(`binDesigner.footLattice.${state.footLatticeX}`)
                  : footLatticeAxes
                      .map(({ value }) => t(`binDesigner.footLattice.${value}`))
                      .join(' / ')
              }
              nonDefault={footLatticeAxes.some(({ value }) => value !== DEFAULT_FOOT_LATTICE)}
            >
              {footLatticeAxes.map(({ axis, value, onChange, locked }) => (
                <div key={axis} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-label text-content-tertiary">
                    {t(`binDesigner.footLattice.axis.${axis}`)}
                  </span>
                  <SegmentedControl
                    aria-label={t(`binDesigner.footLattice.axis.${axis}`)}
                    activeStyle="accent"
                    fullWidth
                    size="sm"
                    value={value}
                    onChange={onChange}
                    options={FOOT_LATTICES.map((lattice) => ({
                      value: lattice,
                      label: t(`binDesigner.footLattice.${lattice}`),
                      disabled: locked && lattice !== 'grid',
                    }))}
                  />
                </div>
              ))}
              <Hint>{handlers.footLatticeLockReason}</Hint>
            </MoreDisclosure>
          )}
        </section>
      )}

      {/* ── Floor ── lightweight relief only; the drainage pattern lives on
          the Style page with the other surface patterns. */}
      {!state.showFloor && state.floorUnavailable && (
        <UnavailableFamily
          title={t('binDesigner.base.section.floor')}
          reason={state.floorUnavailable}
        />
      )}
      {state.showFloor && (
        <section className="space-y-3">
          <SubHeader>{t('binDesigner.base.section.floor')}</SubHeader>

          <div>
            <FeatureToggle
              label={t('binDesigner.lightweight')}
              checked={state.hasLightweight}
              onChange={handlers.toggleLightweight}
              disabledReason={handlers.lightweightDisabledReason}
              valueSummary={t(`binDesigner.lightweightMode.${state.lightweightMode}`)}
            >
              {/* Relief side (#3524). Nested now that the toggle's blocked case
                  has its own way out: the mode decides whether the feature CAN
                  be turned on, so leaving it visible-but-inert was the old way
                  of keeping a scooped bin (the case the feature exists for)
                  from being stranded. The action below does that job instead. */}
              <SegmentedControl
                aria-label={t('binDesigner.lightweightMode')}
                activeStyle="accent"
                fullWidth
                size="sm"
                value={state.lightweightMode}
                onChange={handlers.setLightweightMode}
                options={LIGHTWEIGHT_MODES.map((mode) => ({
                  value: mode,
                  label: t(`binDesigner.lightweightMode.${mode}`),
                }))}
              />
              <Hint>{t(`binDesigner.lightweightMode.${state.lightweightMode}.hint`)}</Hint>
            </FeatureToggle>

            {/* The interior relief is blocked but the underside one is not, so
                the reason above is not the whole story. Mirrors the lid's
                compatibility "Fix" affordance rather than inventing a second
                shape for the same idea. */}
            {state.undersideReliefUnblocks && (
              <Button
                type="button"
                variant="ghost"
                onClick={handlers.enableUndersideRelief}
                className="mt-1 rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-micro font-medium text-content-secondary hover:bg-surface-hover"
              >
                {t('binDesigner.lightweight.useUnderside')}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
