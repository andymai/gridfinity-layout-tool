/**
 * Hinged-lid controls: which wall the lid swings from, and what holds it shut.
 *
 * Its own file for the reason `SlideControls` and `LidGripControls` are: these
 * are the knobs of one attachment mode, and inlining them puts a section the
 * other four modes never render in the middle of a panel that renders for all
 * five.
 *
 * Two knobs and a readout, and the readout is the point. The pin is user-
 * supplied hardware — a filament offcut — so the one number nobody can measure
 * off the model is the length to cut it to, and it changes every time the bin
 * is resized. Quoting it here and again in the export dialog is what makes the
 * hinge assemblable without a ruler.
 *
 * The running fit is deliberately NOT here: it lives under the panel's Advanced
 * disclosure with the other millimetre knobs, because it is the one hinge
 * number with a right answer for a given printer and no right answer in
 * general. Same placement, and the same argument, as the sliding clearance.
 */

import { SegmentedControl } from '@/design-system';
import { Hint, Readout } from '../shared';
import type { useTranslation } from '@/i18n';
import type { useLidSection } from '../LidSection/useLidSection';

type Translator = ReturnType<typeof useTranslation>;

export function HingeControls({
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
          {t('binDesigner.lid.hinge.side')}
        </span>
        <SegmentedControl
          aria-label={t('binDesigner.lid.hinge.side')}
          activeStyle="accent"
          fullWidth
          size="sm"
          value={state.hinge.side}
          onChange={handlers.setHingeSide}
          options={state.hingeSides.map((side) => ({
            value: side,
            label: t(`binDesigner.lid.side.${side}`),
          }))}
        />
        <Hint>{t('binDesigner.lid.hinge.sideHint')}</Hint>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-content-secondary">
          {t('binDesigner.lid.hinge.catch')}
        </span>
        <SegmentedControl
          aria-label={t('binDesigner.lid.hinge.catch')}
          activeStyle="accent"
          fullWidth
          size="sm"
          value={state.hinge.catchMode}
          onChange={handlers.setHingeCatch}
          options={state.hingeCatches.map((mode) => ({
            value: mode,
            label: t(`binDesigner.lid.hinge.catch.${mode}`),
          }))}
        />
        <Hint>{t(`binDesigner.lid.hinge.catch.${state.hinge.catchMode}Hint`)}</Hint>
      </div>

      {/* The plan's own numbers, never the panel's. A run per unbroken stretch
          of wall, so a bin whose hinge wall is split by a cutout genuinely
          needs two offcuts — and saying "1 pin" there would be wrong in the
          one case the segmentation exists to handle. */}
      {state.hingePinLengths.length === 1 && (
        <Readout>
          {t('binDesigner.lid.hinge.pinOne', {
            diameter: state.hingePinMm.toFixed(2),
            length: state.hingePinLengths[0].toFixed(1),
          })}
        </Readout>
      )}
      {state.hingePinLengths.length > 1 && (
        <Readout>
          {t('binDesigner.lid.hinge.pinMany', {
            count: state.hingePinLengths.length,
            diameter: state.hingePinMm.toFixed(2),
            lengths: state.hingePinLengths.map((mm) => mm.toFixed(1)).join(' + '),
          })}
        </Readout>
      )}
    </div>
  );
}
