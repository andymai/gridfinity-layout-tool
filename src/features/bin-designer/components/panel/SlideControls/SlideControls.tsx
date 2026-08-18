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
import { Switch } from '@/design-system/Switch';
import { Hint, Readout } from '../shared';
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
        <span className="mb-1 block text-xs font-medium text-content-secondary">
          {t('binDesigner.lid.slide.placement')}
        </span>
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
        <Hint>{t(`binDesigner.lid.slide.placement.${state.slide.placement}Hint`)}</Hint>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-content-secondary">
          {t('binDesigner.lid.slide.entrySide')}
        </span>
        <SegmentedControl
          aria-label={t('binDesigner.lid.slide.entrySide')}
          activeStyle="accent"
          fullWidth
          size="sm"
          value={state.slide.entrySide}
          onChange={handlers.setSlideEntrySide}
          options={state.slideEntrySides.map((side) => ({
            value: side,
            label: t(`binDesigner.lid.side.${side}`),
          }))}
        />
        <Hint>{t('binDesigner.lid.slide.entrySideHint')}</Hint>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-content-secondary">
          {t('binDesigner.lid.slide.pull')}
        </span>
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
        <Hint>{t(`binDesigner.lid.slide.pull.${state.slide.pull}Hint`)}</Hint>
      </div>

      <div className="space-y-1">
        <Switch
          label={t('binDesigner.lid.slide.detent')}
          checked={state.slide.detent}
          onChange={handlers.toggleSlideDetent}
        />
        <Hint>{t('binDesigner.lid.slide.detentHint')}</Hint>
      </div>

      {/* The plan's own account of the span, so the sag advice names a real
          number rather than a rule of thumb. */}
      {state.slideFreeSpanMm !== null && (
        <Readout>
          {t('binDesigner.lid.slide.spanReadout', {
            span: state.slideFreeSpanMm.toFixed(1),
          })}
        </Readout>
      )}
    </div>
  );
}
