/**
 * Sliding-lid controls: where the channel sits, which wall it opens through,
 * how you get hold of it, and whether it clicks shut.
 *
 * Its own file for the reason `LidGripControls` is: these are the knobs of one
 * attachment mode, and inlining them puts a section the other three modes never
 * render in the middle of the panel that renders for all four.
 *
 * The sliding clearance is deliberately NOT here — it lives under the panel's
 * Advanced disclosure with the other millimetre knobs, because it is the one
 * number with a right answer for a given printer and no right answer in
 * general, and that is a tuning job rather than a choice.
 */

import { SegmentedControl } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { FieldLabel, OptionNotes, Readout, SideSelector } from '../shared';
import { SLIDE_SAG_SPAN_MM } from '@/shared/utils/slideLidPlan';
import type { useTranslation } from '@/i18n';
import type { useLidSection } from '../LidSection/useLidSection';

type Translator = ReturnType<typeof useTranslation>;

export function SlideControls({
  state,
  handlers,
  t,
}: {
  state: ReturnType<typeof useLidSection>['state'];
  handlers: ReturnType<typeof useLidSection>['handlers'];
  t: Translator;
}) {
  return (
    <div className="space-y-2">
      <div>
        <FieldLabel
          info={
            <OptionNotes
              options={state.slidePlacements.map((mode) => ({
                label: t(`binDesigner.lid.slide.placement.${mode}`),
                note: t(`binDesigner.lid.slide.placement.${mode}Hint`),
              }))}
            />
          }
        >
          {t('binDesigner.lid.slide.placement')}
        </FieldLabel>
        <SegmentedControl
          aria-label={t('binDesigner.lid.slide.placement')}
          activeStyle="accent"
          fullWidth
          size="sm"
          value={state.slide.placement}
          onChange={handlers.setSlidePlacement}
          options={state.slidePlacements.map((mode) => ({
            value: mode,
            label: t(`binDesigner.lid.slide.placement.${mode}`),
          }))}
        />
      </div>

      <div>
        <FieldLabel info={t('binDesigner.lid.slide.entrySideHint')}>
          {t('binDesigner.lid.slide.entrySide')}
        </FieldLabel>
        <SideSelector
          mode="single"
          ariaLabel={t('binDesigner.lid.slide.entrySide')}
          value={state.slide.entrySide}
          onSelect={handlers.setSlideEntrySide}
          sides={state.slideEntrySides.map((side) => ({
            side,
            label: t(`binDesigner.lid.side.${side}`),
          }))}
        />
      </div>

      <div>
        <FieldLabel
          info={
            <OptionNotes
              options={state.slidePulls.map((mode) => ({
                label: t(`binDesigner.lid.slide.pull.${mode}`),
                note: t(`binDesigner.lid.slide.pull.${mode}Hint`),
              }))}
            />
          }
        >
          {t('binDesigner.lid.slide.pull')}
        </FieldLabel>
        <SegmentedControl
          aria-label={t('binDesigner.lid.slide.pull')}
          activeStyle="accent"
          fullWidth
          size="sm"
          value={state.slide.pull}
          onChange={handlers.setSlidePull}
          options={state.slidePulls.map((mode) => ({
            value: mode,
            label: t(`binDesigner.lid.slide.pull.${mode}`),
          }))}
        />
      </div>

      <FeatureToggle
        label={t('binDesigner.lid.slide.detent')}
        checked={state.slide.detent}
        onChange={handlers.toggleSlideDetent}
        info={t('binDesigner.lid.slide.detentHint')}
      />

      {/* The plan's own account of the span, so the sag advice names a real
          number rather than a rule of thumb. */}
      {state.slideFreeSpanMm !== null && (
        <Readout>
          {t('binDesigner.lid.slide.spanReadout', {
            span: state.slideFreeSpanMm.toFixed(1),
          })}
        </Readout>
      )}
      {/* Same gate as the `slideLongSpan` warning, so the number that answers
          it appears exactly when the warning does. */}
      {state.slideFreeSpanMm !== null &&
        state.slideFreeSpanMm > SLIDE_SAG_SPAN_MM &&
        state.slideSagThicknessMm !== null && (
          <Readout>
            {t('binDesigner.lid.slide.sagThicknessReadout', {
              thickness: state.slideSagThicknessMm.toFixed(1),
            })}
          </Readout>
        )}
    </div>
  );
}
