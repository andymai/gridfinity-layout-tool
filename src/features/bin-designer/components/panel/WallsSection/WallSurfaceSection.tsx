/**
 * Wall surface styling: carved patterns and auto-fit surface text on the outer
 * walls. Lives on the Style page; thickness stays with Shape.
 */

import { SliderInput, SegmentedControl, Checkbox, Stepper } from '@/design-system';
import type { TextMode } from '@/features/bin-designer/types';
import {
  MAX_WALL_LABEL_SLOT_PITCH_CELLS,
  PATTERN_WEB_THICKNESS_MAX,
  PATTERN_WEB_THICKNESS_MIN,
  PATTERN_WEB_THICKNESS_STEP,
  WALL_PATTERN_SIDES,
  WALL_TEXT_SIDES,
  isKumikoPattern,
} from '@/features/bin-designer/types';
import { useWallsSection } from './useWallsSection';
import { PatternSelector } from './PatternSelector';
import { FeatureToggle } from '../FeatureToggle';
import { CompartmentTextInput } from '../LabelTabsSection/CompartmentTextInput';
import { LabelPlatesControls } from '../LabelTabsSection/LabelPlatesControls';
import { AnchorPicker } from '../../controls/AnchorPicker';
import { Hint, Readout, SideSelector, SubHeader, type SideState } from '../shared';

/** Mode options for the wall-text picker, in the shared textMode order. */
const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'] as const;

export function WallSurfaceSection() {
  const { state, handlers, t } = useWallsSection();

  // A slot-blocked wall can't carry a pattern, and SideSelector renders a
  // disabled side as off — so the stored selection passes through unchanged and
  // is restored the moment the slots go away.
  const patternSideStates: SideState[] = WALL_PATTERN_SIDES.map((side) => ({
    side,
    label: t(`binDesigner.lid.side.${side}`),
    active: state.patternSides[side],
    disabled: state.patternSideBlocked[side],
    title: state.patternSideBlocked[side]
      ? t('binDesigner.walls.pattern.sides.slotted')
      : undefined,
  }));

  const labelSlotSideStates: SideState[] = WALL_PATTERN_SIDES.map((side) => ({
    side,
    label: t(`binDesigner.lid.side.${side}`),
    active: state.labelSlotSides[side],
    disabled: state.labelSlotSideBlocked[side],
    title: state.labelSlotSideBlocked[side]
      ? t('binDesigner.walls.labelSlots.sides.narrow')
      : undefined,
  }));

  return (
    <div className="space-y-4">
      <SubHeader>{t('binDesigner.style.section.walls')}</SubHeader>
      <div>
        <PatternSelector
          selectedPattern={state.patternEnabled ? state.pattern : null}
          onChange={handlers.handlePatternChange}
          disabled={state.patternDisabled}
          disabledReason={state.patternDisabledReason}
        />
        {state.patternPartialNote && state.patternEnabled && (
          <p className="text-label text-content-tertiary mt-1">{state.patternPartialNote}</p>
        )}
        {state.patternEnabled && !state.patternDisabled && (
          <>
            <div className="mt-3">
              <SliderInput
                label={t('binDesigner.walls.pattern.scale')}
                value={state.patternScalePercent}
                onChange={handlers.handleScaleChange}
                min={0}
                max={100}
                step={5}
                unit="%"
                info={t('binDesigner.walls.pattern.scaleHint')}
              />
            </div>
            {!isKumikoPattern(state.pattern) && (
              <div className="mt-3">
                <SliderInput
                  label={t('binDesigner.walls.pattern.strutWidth')}
                  value={state.patternWebThickness}
                  onChange={handlers.handleWebThicknessChange}
                  min={PATTERN_WEB_THICKNESS_MIN}
                  max={PATTERN_WEB_THICKNESS_MAX}
                  step={PATTERN_WEB_THICKNESS_STEP}
                  unit="mm"
                  info={t('binDesigner.walls.pattern.strutWidthHint')}
                />
              </div>
            )}
            {/* ── Patterned walls (#2966) — pick which outer walls carry the
                pattern, same spatial selector the cutout/handle sections use.
                Suppressed when the pattern renders nothing on this bin, so the
                chips can't claim walls that export solid. */}
            {state.patternInertReason ? (
              <p className="mt-3 text-label leading-relaxed text-content-tertiary">
                {state.patternInertReason}
              </p>
            ) : (
              <div className="mt-3">
                <span className="mb-1 block text-label text-content-tertiary">
                  {t('binDesigner.walls.pattern.sides')}
                </span>
                <SideSelector
                  sides={patternSideStates}
                  onToggle={handlers.togglePatternSide}
                  ariaLabel={t('binDesigner.walls.pattern.sides')}
                />
                {state.patternSidesNote && (
                  <p className="mt-1 text-label leading-relaxed text-content-tertiary">
                    {state.patternSidesNote}
                  </p>
                )}
              </div>
            )}
            {/* ── Divider walls (#2811) — the same pattern and scale carried
                through the compartment dividers, so a patterned bin doesn't
                read as hollow walls around solid dividers. */}
            <div className="mt-3 border-t border-stroke-subtle/50 pt-2">
              <Checkbox
                checked={state.dividersEnabled}
                onChange={handlers.handleDividersChange}
                disabled={state.dividersAvailableReason !== undefined}
                label={t('binDesigner.walls.pattern.dividers')}
              />
              <p className="ml-6 mt-1 text-label leading-relaxed text-content-tertiary">
                {state.dividersAvailableReason ??
                  state.dividersNote ??
                  t('binDesigner.walls.pattern.dividersHint')}
              </p>
            </div>
          </>
        )}
      </div>
      {/* ── Wall text (#2695) — auto-fit surface text on the outer walls,
          gated behind a toggle like the sibling cutout/handle sections.
          The pattern is cleared behind the text; per-wall gates (slots)
          apply in the worker. */}
      <FeatureToggle
        label={t('binDesigner.walls.text.heading')}
        checked={state.isWallTextOpen}
        onChange={handlers.toggleWallText}
        disabledReason={state.wallTextDisabledReason}
        primaryControls={
          <>
            <div className="grid grid-cols-2 gap-2">
              {WALL_TEXT_SIDES.map((side, index) => (
                <div key={side}>
                  <span className="mb-1 block text-label text-content-tertiary">
                    {t(`binDesigner.lid.side.${side}`)}
                  </span>
                  <CompartmentTextInput
                    multiline
                    committedValue={state.wallTexts[side] ?? ''}
                    compartmentId={index}
                    placeholder={t('binDesigner.walls.text.placeholder')}
                    ariaLabel={t('binDesigner.walls.text.sideAria', {
                      side: t(`binDesigner.lid.side.${side}`),
                    })}
                    onCommit={handlers.commitWallTextAt}
                  />
                </div>
              ))}
            </div>
            {state.hasAnyWallText && (
              <>
                <SegmentedControl
                  aria-label={t('binDesigner.textMode')}
                  activeStyle="accent"
                  fullWidth
                  size="sm"
                  value={state.wallTextMode}
                  onChange={handlers.setTextMode}
                  options={TEXT_MODE_OPTIONS.map((mode) => ({
                    value: mode,
                    label: t(`binDesigner.textMode.${mode}`),
                  }))}
                />
                {state.wallTextMode === 'through-cut' && (
                  <p className="text-label leading-relaxed text-content-tertiary">
                    {t('binDesigner.textMode.throughCutStencilNote')}
                  </p>
                )}
                <div className="space-y-1">
                  <span className="block text-label text-content-tertiary">
                    {t('binDesigner.type.anchor')}
                  </span>
                  <AnchorPicker
                    value={state.wallTextAnchor}
                    onChange={handlers.setSurfaceTextAnchor}
                    label={t('binDesigner.walls.text.anchor')}
                  />
                </div>
                <p className="text-label leading-relaxed text-content-tertiary">
                  {t('binDesigner.walls.text.hint')}
                </p>
                <p className="text-label leading-relaxed text-content-tertiary">
                  {t('binDesigner.type.secondLineHint')}
                </p>
              </>
            )}
          </>
        }
      />
      <FeatureToggle
        label={t('binDesigner.walls.labelSlots.heading')}
        checked={state.labelSlotsEnabled}
        onChange={handlers.toggleLabelSlots}
        disabledReason={state.labelSlotsDisabledReason}
        primaryControls={
          <>
            <Hint>{t('binDesigner.walls.labelSlots.hint')}</Hint>
            <div>
              <span className="mb-1 block text-label text-content-tertiary">
                {t('binDesigner.walls.labelSlots.sides')}
              </span>
              <SideSelector
                sides={labelSlotSideStates}
                onToggle={handlers.toggleLabelSlotSide}
                ariaLabel={t('binDesigner.walls.labelSlots.sides')}
              />
              {state.labelSlotSidesNote && (
                <p className="mt-1 text-label leading-relaxed text-content-tertiary">
                  {state.labelSlotSidesNote}
                </p>
              )}
            </div>
            <div>
              <span className="mb-1 block text-label text-content-tertiary">
                {t('binDesigner.walls.labelSlots.spacing')}
              </span>
              <Stepper
                aria-label={t('binDesigner.walls.labelSlots.spacing')}
                value={state.labelSlotEveryCells}
                onStep={handlers.stepLabelSlotEveryCells}
                min={1}
                max={MAX_WALL_LABEL_SLOT_PITCH_CELLS}
                displayValue={
                  state.labelSlotEveryCells === 1
                    ? t('binDesigner.walls.labelSlots.spacing.one')
                    : t('binDesigner.walls.labelSlots.spacing.other', {
                        count: state.labelSlotEveryCells,
                      })
                }
                size="sm"
                fullWidth
              />
            </div>
            {state.labelSlotCount > 0 && (
              <Readout>
                {state.labelSlotCount === 1
                  ? t('binDesigner.walls.labelSlots.count.one')
                  : t('binDesigner.walls.labelSlots.count.other', { count: state.labelSlotCount })}
              </Readout>
            )}
            {state.labelSlotNotes.map((note) => (
              <Hint key={note}>{note}</Hint>
            ))}
            {state.labelSlotPlatesHere && <LabelPlatesControls />}
          </>
        }
      />
    </div>
  );
}
